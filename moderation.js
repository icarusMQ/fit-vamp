/* Red Flag Court — peer-driven moderation (see .claude/plans/social-
   leaderboards.md, "Red Flag Court"). Same event-sourced pattern as
   everything else in this app: flag state is never declared by a central
   authority, it's *derived* locally from cached signed reports and votes,
   scoped per group (a report only counts within the group it was filed in).

   Consequences distinguish two audiences:
     - mascot/sound/lockout are self-directed — they reflect whether *this
       device's own identity* is currently flagged, shown only to that user.
     - the Drops multiplier is what *other people* see when a flagged
       user shows up in a shared leaderboard (drops.js/leaderboards.js). */

const REPORT_THRESHOLD_PCT = 0.10;
const REPORT_THRESHOLD_CAP = 10;
const COURT_WINDOW_DAYS = 14;
const FLAGGED_DROPS_MULTIPLIER = 0.2;
const LOCKOUT_STRIKE_COUNT = 3;
const LOCKOUT_LS_KEY = "ft_locked_out";

// ============================= pure derivation =============================

function flagThreshold(groupSize) {
  return Math.min(Math.ceil(REPORT_THRESHOLD_PCT * groupSize), REPORT_THRESHOLD_CAP);
}

// One report per reporter per target per group by construction (see the
// `reports` id scheme below), so distinct-reporter counting falls out of
// just counting rows.
function reportersFor(reports, targetPubkey, groupId) {
  return reports.filter((r) => r.targetPubkey === targetPubkey && r.groupId === groupId);
}

// ts of the report that crossed the threshold, or null if not (yet) flagged.
function flaggedAt(reports, targetPubkey, groupId, groupSize) {
  const threshold = flagThreshold(groupSize);
  if (threshold <= 0) return null;
  const relevant = reportersFor(reports, targetPubkey, groupId).sort((a, b) => a.ts - b.ts);
  if (relevant.length < threshold) return null;
  return relevant[threshold - 1].ts;
}

function courtDeadline(flaggedAtTs) {
  return flaggedAtTs + COURT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function voteTally(votes, targetPubkey, groupId) {
  const relevant = votes.filter((v) => v.targetPubkey === targetPubkey && v.groupId === groupId);
  const clear = relevant.filter((v) => v.vote === "clear").length;
  const uphold = relevant.filter((v) => v.vote === "uphold").length;
  return { clear, uphold, total: relevant.length };
}

// null = never flagged; "pending" = in the court window, outcome not final
// yet; "cleared" / "upheld" = decided once the window closes. Matches the
// plan literally: votes only decide the outcome *at* the window's close
// ("no video, or window closes with no quorum -> auto-upheld"), not the
// moment a majority first forms, so a late swing still counts.
function courtStatus({ flaggedAtTs, tally, now }) {
  if (flaggedAtTs == null) return null;
  if (now < courtDeadline(flaggedAtTs)) return "pending";
  return tally.clear > tally.uphold ? "cleared" : "upheld";
}

async function flagStatusFor(targetPubkey, groupId) {
  const group = await dbGet("groups", groupId);
  if (!group) return null;
  const [reports, votes] = await Promise.all([dbGetAll("reports"), dbGetAll("courtVotes")]);
  const fAt = flaggedAt(reports, targetPubkey, groupId, group.memberPubkeys.length);
  if (fAt == null) return null;
  const tally = voteTally(votes, targetPubkey, groupId);
  const status = courtStatus({ flaggedAtTs: fAt, tally, now: Date.now() });
  return { flaggedAt: fAt, deadline: courtDeadline(fAt), status, tally, threshold: flagThreshold(group.memberPubkeys.length) };
}

// Every currently-consequential (pending or upheld — a cleared flag carries
// no penalty) flagged pubkey, scoped to one group or across every group
// this device knows about. Used to apply the Drops multiplier when
// rendering someone else's leaderboard row.
async function computeFlaggedPubkeys(groupId) {
  const [reports, votes, allGroups] = await Promise.all([dbGetAll("reports"), dbGetAll("courtVotes"), dbGetAll("groups")]);
  const now = Date.now();
  const groups = groupId ? allGroups.filter((g) => g.id === groupId) : allGroups;
  const flagged = new Set();
  for (const group of groups) {
    for (const pubkey of group.memberPubkeys) {
      const fAt = flaggedAt(reports, pubkey, group.id, group.memberPubkeys.length);
      if (fAt == null) continue;
      const status = courtStatus({ flaggedAtTs: fAt, tally: voteTally(votes, pubkey, group.id), now });
      if (status === "pending" || status === "upheld") flagged.add(pubkey);
    }
  }
  return flagged;
}

// ============================= submitting =============================

async function submitReport(targetPubkey, groupId, reason) {
  const group = await dbGet("groups", groupId);
  if (!group) throw new Error("Group not found.");
  const identity = await getOrCreateIdentity();
  if (targetPubkey === identity.pubkeyB64) throw new Error("You can't report yourself.");
  if (!group.memberPubkeys.includes(targetPubkey)) throw new Error("Not a member of this group.");

  const report = {
    id: `${targetPubkey}:${identity.pubkeyB64}:${groupId}`,
    targetPubkey, groupId, reporterPubkey: identity.pubkeyB64,
    reason: (reason || "").trim().slice(0, 200),
    ts: Date.now(),
  };
  await dbPut("reports", report);
  if (typeof broadcastToGroup === "function") await broadcastToGroup(group, "report", report);
  return report;
}

async function submitCourtVote(targetPubkey, groupId, vote) {
  if (vote !== "clear" && vote !== "uphold") throw new Error("Invalid vote.");
  const group = await dbGet("groups", groupId);
  if (!group) throw new Error("Group not found.");
  const identity = await getOrCreateIdentity();
  if (targetPubkey === identity.pubkeyB64) throw new Error("You can't vote on your own case.");

  const record = { id: `${targetPubkey}:${groupId}:${identity.pubkeyB64}`, targetPubkey, groupId, voterPubkey: identity.pubkeyB64, vote, ts: Date.now() };
  await dbPut("courtVotes", record);
  if (typeof broadcastToGroup === "function") await broadcastToGroup(group, "court-vote", record);
  return record;
}

// Records a submitted defense as an S3 *key*, not a URL — no single
// presigned URL can legally live for the whole 14-day court window (SigV4
// caps at 7 days), so a fresh short-lived viewing URL is minted on demand
// by relay-server/court-upload-server.js whenever someone wants to watch
// it (getCourtVideoUrl, below). The bytes never pass through the relay's
// WebSocket — only this metadata does, once uploaded straight to S3.
async function recordCourtVideo(targetPubkey, groupId, key) {
  const group = await dbGet("groups", groupId);
  if (!group) throw new Error("Group not found.");
  const record = { id: `${targetPubkey}:${groupId}`, targetPubkey, groupId, key, submittedAt: Date.now() };
  await dbPut("courtVideos", record);
  if (typeof broadcastToGroup === "function") await broadcastToGroup(group, "court-video", record);
  return record;
}

// ============================= court video upload/view =============================

const COURT_ENDPOINT_LS_KEY = "ft_court_endpoint";
function getCourtEndpoint() { return localStorage.getItem(COURT_ENDPOINT_LS_KEY) || ""; }
function setCourtEndpoint(url) { localStorage.setItem(COURT_ENDPOINT_LS_KEY, url.trim()); }

async function signedCourtRequest(extraFields) {
  const identity = await getOrCreateIdentity();
  // Timestamp-prefixed so the server can reject stale or replayed nonces
  // (see relay-server/court-upload-server.js's checkAndConsumeNonce) —
  // a bare random nonce with no freshness signal would let a captured
  // request be replayed forever to keep minting fresh signed URLs.
  const nonce = `${Date.now()}:${crypto.randomUUID()}`;
  const sig = bufToB64Url(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, identity.privateKey, new TextEncoder().encode(nonce)
  ));
  return { pubkey: identity.pubkeyB64, nonce, sig, ...extraFields };
}

async function courtFetch(path, body) {
  const endpoint = getCourtEndpoint();
  if (!endpoint) throw new Error("No court upload endpoint configured (Friends → Sync).");
  const res = await fetch(`${endpoint.replace(/\/$/, "")}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Court server error (${res.status}).`);
  return res.json();
}

// Uploads a recorded defense video and returns the S3 key to pass to
// recordCourtVideo — never a URL, per the note above.
async function uploadCourtVideo(blob, groupId) {
  const identity = await getOrCreateIdentity();
  const { uploadUrl, key } = await courtFetch(
    "/court-upload-url",
    await signedCourtRequest({ targetPubkey: identity.pubkeyB64, groupId, contentType: blob.type || "video/webm" })
  );
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": blob.type || "video/webm" }, body: blob });
  if (!putRes.ok) throw new Error("Video upload failed.");
  return key;
}

async function getCourtVideoUrl(key) {
  const { url } = await courtFetch("/court-video-url", await signedCourtRequest({ key }));
  return url;
}

// ============================= escalation / lockout =============================

function isLockedOut() { return localStorage.getItem(LOCKOUT_LS_KEY) === "1"; }

// Walks every group this device's identity belongs to, finalizes any court
// window that has closed since we last checked (recording it to
// flagHistory exactly once), and recomputes the lockout flag from the
// running upheld-strike count. Cheap enough to just run on every boot and
// whenever the moderation UI opens.
async function checkEscalationAndLockout() {
  const identity = await getOrCreateIdentity();
  const [myGroups, reports, votes, history] = await Promise.all([
    dbGetAll("groups").then((gs) => gs.filter((g) => g.memberPubkeys.includes(identity.pubkeyB64))),
    dbGetAll("reports"), dbGetAll("courtVotes"), dbGetAll("flagHistory"),
  ]);
  const now = Date.now();

  for (const group of myGroups) {
    const fAt = flaggedAt(reports, identity.pubkeyB64, group.id, group.memberPubkeys.length);
    if (fAt == null || now < courtDeadline(fAt)) continue;
    const already = history.some((h) => h.targetPubkey === identity.pubkeyB64 && h.groupId === group.id && h.flaggedAt === fAt);
    if (already) continue;
    const tally = voteTally(votes, identity.pubkeyB64, group.id);
    const outcome = tally.clear > tally.uphold ? "cleared" : "upheld";
    await dbAdd("flagHistory", { targetPubkey: identity.pubkeyB64, groupId: group.id, flaggedAt: fAt, outcome, resolvedAt: now });
  }

  const upheldCount = (await dbGetAll("flagHistory")).filter((h) => h.targetPubkey === identity.pubkeyB64 && h.outcome === "upheld").length;
  const lockedOut = upheldCount >= LOCKOUT_STRIKE_COUNT;
  localStorage.setItem(LOCKOUT_LS_KEY, lockedOut ? "1" : "");
  return lockedOut;
}

async function amIConsequentiallyFlagged() {
  const identity = await getOrCreateIdentity();
  const groups = (await dbGetAll("groups")).filter((g) => g.memberPubkeys.includes(identity.pubkeyB64));
  for (const g of groups) {
    const s = await flagStatusFor(identity.pubkeyB64, g.id);
    if (s && (s.status === "pending" || s.status === "upheld")) return true;
  }
  return false;
}

// The self-directed consequences (mascot.js / sounds.js) — call after
// boot and after anything that could change this device's own flag status
// (a new report/vote lands, or a court window closes).
async function applyModerationConsequences() {
  const flagged = await amIConsequentiallyFlagged();
  if (typeof setMascotFlagged === "function") setMascotFlagged(flagged);
  if (typeof setFartMode === "function") setFartMode(flagged);
  return flagged;
}

// Wipes every local store and this device's identity, then tells every
// paired friend to forget this device too — the one action a locked-out
// user can still take. Irreversible; the caller (app.js) is responsible for
// confirming with the user before calling this.
async function deleteAllMyData() {
  const identity = await getOrCreateIdentity().catch(() => null);
  if (identity && typeof queueOutbox === "function") {
    const friends = await dbGetAll("friends");
    for (const f of friends) {
      await queueOutbox(f.pubkey, "revoke", { scope: "friend", targetPubkey: identity.pubkeyB64 });
    }
    // Poll until the outbox actually drains (confirmed sent, not just
    // queued) instead of trusting a fixed timer — a blind 1.5s wait could
    // wipe the outbox, and the revoke notices in it, before anything was
    // delivered. Still bounded: if we're offline and it'll never drain,
    // the user needs a way to finish wiping their data regardless.
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const remaining = await dbGetAll("outbox");
      if (!remaining.length) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const db = await openDB();
  db.close();
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = resolve; req.onerror = reject; req.onblocked = resolve;
  });
  localStorage.clear();
  location.reload();
}
