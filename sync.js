/* Relay sync — connects to the WebSocket relay this device is configured to
   use (Friends tab → Sync), authenticates with this device's identity
   keypair, and moves encrypted messages to/from paired friends via the
   outbox. The relay is a dumb, untrusted pipe: it routes ciphertext between
   pubkeys and never sees plaintext, because every payload is encrypted
   per-recipient with a key only the two of you can derive (ECDH). See
   .claude/plans/social-leaderboards.md and relay-server/ for the server side.

   Step-3 scope: prove the transport (auth, encrypt, queue-while-offline,
   deliver, decrypt) works end to end using a simple "ping". Real payload
   types (workout events, group rosters, revokes) arrive in later steps and
   plug into `handleIncoming` / `queueOutbox` without changing this file's
   plumbing. */

const RELAY_URL_KEY = "ft_relay_url";
function getRelayUrl() { return localStorage.getItem(RELAY_URL_KEY) || ""; }
function setRelayUrl(url) { localStorage.setItem(RELAY_URL_KEY, url.trim()); }

// The project's own maintained relay — offered as the one-tap "standard"
// option during onboarding (onboarding.js). Users can always point at their
// own instead, here or in Friends → Sync.
const DEFAULT_RELAY_URL = "wss://56.125.84.213.sslip.io";

let socket = null;
let manuallyClosed = true;
let reconnectDelay = 1000;
let reconnectTimer = null;
let connectionState = "offline"; // offline | connecting | online

function setConnectionState(state) {
  connectionState = state;
  document.querySelectorAll("[data-sync-status]").forEach((el) => {
    el.textContent = { offline: "Offline", connecting: "Connecting…", online: "Connected" }[state];
    el.dataset.syncStatus = state;
  });
}

// ============================= crypto =============================

async function signNonce(nonce) {
  const identity = await getOrCreateIdentity();
  const data = new TextEncoder().encode(nonce);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, identity.privateKey, data);
  return bufToB64Url(sig);
}

const sharedKeyCache = new Map(); // friend pubkey -> derived AES-GCM CryptoKey

async function sharedKeyWithFriend(friend) {
  if (sharedKeyCache.has(friend.pubkey)) return sharedKeyCache.get(friend.pubkey);
  const identity = await getOrCreateIdentity();
  const friendEcdhKey = await crypto.subtle.importKey(
    "raw", b64UrlToBuf(friend.ecdhPubkey), { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: friendEcdhKey }, identity.ecdhPrivateKey,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
  sharedKeyCache.set(friend.pubkey, key);
  return key;
}

async function encryptFor(friend, plainObj) {
  const key = await sharedKeyWithFriend(friend);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(plainObj));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufToB64Url(combined.buffer);
}

async function decryptFrom(friend, payloadB64) {
  const key = await sharedKeyWithFriend(friend);
  const combined = new Uint8Array(b64UrlToBuf(payloadB64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

// ============================= outbox =============================
//
// The recipient's ECDH key is captured *now*, at enqueue time, not looked
// up again at send time — otherwise removing a friend right after queuing
// a message to them (e.g. the "you removed me" revoke notice itself) would
// silently drop it, since by send time there'd be no friend record left to
// encrypt against.

async function queueOutbox(toPubkey, type, data) {
  const friend = await dbGet("friends", toPubkey);
  if (!friend) return; // never paired, or already removed — nothing to encrypt against
  await dbAdd("outbox", { toPubkey, toEcdhPubkey: friend.ecdhPubkey, type, data, createdAt: Date.now() });
  flushOutbox();
}

async function broadcastToAllFriends(type, data) {
  const friends = await dbGetAll("friends");
  for (const friend of friends) await queueOutbox(friend.pubkey, type, data);
}

async function flushOutbox() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const identity = await getOrCreateIdentity();
  const items = await dbGetAll("outbox");
  for (const item of items) {
    try {
      const payload = await encryptFor({ pubkey: item.toPubkey, ecdhPubkey: item.toEcdhPubkey }, { type: item.type, data: item.data });
      // fromEcdhPubkey rides in the clear alongside the ciphertext (it's a
      // public key, not a secret) so the recipient can derive the shared
      // key and decrypt even if this is the first they've ever heard of us
      // — e.g. an existing group member learning about a brand-new joiner
      // via a group-roster broadcast, who by definition isn't a friend yet.
      socket.send(JSON.stringify({ type: "send", to: item.toPubkey, payload, fromEcdhPubkey: identity.ecdhPubkeyB64 }));
      await dbDelete("outbox", item.id);
    } catch {
      // leave it queued; will retry next flush (e.g. next reconnect)
    }
  }
}

// ============================= incoming =============================

async function handleIncoming(fromPubkey, plain) {
  if (plain.type === "ping") {
    const friend = await dbGet("friends", fromPubkey);
    showToast(`Ping from ${friend ? displayNameOf({ username: friend.username, userTag: friend.userTag }) : "a friend"}!`);
    return;
  }
  if (plain.type === "friend-add") {
    // Sent by identity.js right after *scanning* someone's code — a QR scan
    // only ever adds the friend on the scanner's own device, so without this
    // the scanned person never learns the scanner exists. Uses fromPubkey
    // (relay-authenticated) as the pk, not anything the payload claims, same
    // trust pattern as everywhere else here. Works even if this is the first
    // message ever received from them, same as a group-roster introduction —
    // decryption already succeeded via fromEcdhPubkey (see flushOutbox).
    if (typeof upsertFriendFromKeys === "function") {
      await upsertFriendFromKeys({ pk: fromPubkey, ek: plain.data?.ek, n: plain.data?.n, t: plain.data?.t });
    }
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "workout-event") {
    const event = plain.data;
    // Trust the relay-authenticated sender over anything the payload claims —
    // a friend's device can't pretend an event was authored by someone else.
    if (!event || event.authorPubkey !== fromPubkey) return;
    await dbPut("leaderboardEvents", event);
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "profile-update") {
    const friend = await dbGet("friends", fromPubkey);
    if (!friend) return;
    friend.genderSelf = plain.data?.genderSelf || undefined;
    friend.heightCm = plain.data?.heightCm > 0 ? plain.data.heightCm : undefined;
    await dbPut("friends", friend);
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "group-roster") {
    if (typeof applyIncomingGroupRoster === "function") await applyIncomingGroupRoster(plain.data);
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "revoke") {
    const scope = plain.data?.scope;
    if (scope === "friend") {
      // Trust who actually sent this over who the payload claims — a friend
      // leaving can only ever remove *themselves* from your list this way.
      await dbDelete("friends", fromPubkey);
      const events = await dbGetAll("leaderboardEvents");
      for (const e of events) if (e.authorPubkey === fromPubkey) await dbDelete("leaderboardEvents", e.id);
    } else if (scope === "group" && typeof applyIncomingRevoke === "function") {
      await applyIncomingRevoke(fromPubkey, plain.data);
    }
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "report") {
    const r = plain.data;
    // Trust fromPubkey as the actual reporter over whatever the payload
    // claims — a forwarded/replayed report can't be credited to someone
    // who didn't send it. Also require fromPubkey to actually be a member
    // of the target group — otherwise a removed/never-member friend could
    // stuff reports toward the flag threshold.
    if (!r || r.reporterPubkey !== fromPubkey) return;
    const reportGroup = await dbGet("groups", r.groupId);
    if (!reportGroup || !reportGroup.memberPubkeys.includes(fromPubkey)) return;
    await dbPut("reports", r);
    if (typeof checkEscalationAndLockout === "function") await checkEscalationAndLockout();
    if (typeof applyModerationConsequences === "function") await applyModerationConsequences();
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "court-vote") {
    const v = plain.data;
    if (!v || v.voterPubkey !== fromPubkey) return;
    const voteGroup = await dbGet("groups", v.groupId);
    if (!voteGroup || !voteGroup.memberPubkeys.includes(fromPubkey)) return;
    await dbPut("courtVotes", v);
    if (typeof checkEscalationAndLockout === "function") await checkEscalationAndLockout();
    if (typeof applyModerationConsequences === "function") await applyModerationConsequences();
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
  if (plain.type === "court-video") {
    const rec = plain.data;
    if (!rec || rec.targetPubkey !== fromPubkey) return; // only the accused can submit their own defense
    await dbPut("courtVideos", rec);
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
    return;
  }
}

// ============================= connection =============================

function connectRelay() {
  const url = getRelayUrl();
  if (!url) return;
  manuallyClosed = false;
  clearTimeout(reconnectTimer);
  setConnectionState("connecting");

  try { socket = new WebSocket(url); }
  catch { setConnectionState("offline"); scheduleReconnect(); return; }

  socket.addEventListener("message", async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === "challenge") {
      const identity = await getOrCreateIdentity();
      const sig = await signNonce(msg.nonce);
      socket.send(JSON.stringify({ type: "auth", pubkey: identity.pubkeyB64, sig }));
      return;
    }
    if (msg.type === "auth-ok") {
      reconnectDelay = 1000;
      setConnectionState("online");
      flushOutbox();
      return;
    }
    if (msg.type === "deliver") {
      // Prefer an already-known friend's cached key; fall back to the
      // envelope's fromEcdhPubkey for a sender we've never paired with
      // directly — the introduction case (see flushOutbox). Either way,
      // decryption only succeeds if the sender actually holds the matching
      // private key, so this doesn't weaken authenticity.
      const friend = await dbGet("friends", msg.from);
      const sender = friend || (msg.fromEcdhPubkey ? { pubkey: msg.from, ecdhPubkey: msg.fromEcdhPubkey } : null);
      if (!sender) return;
      let plain;
      try { plain = await decryptFrom(sender, msg.payload); } catch { return; }
      try { await handleIncoming(msg.from, plain); } catch (err) { console.error("handleIncoming failed", err); }
      return;
    }
  });

  socket.addEventListener("close", () => { setConnectionState("offline"); scheduleReconnect(); });
  socket.addEventListener("error", () => socket.close());
}

function scheduleReconnect() {
  if (manuallyClosed) return;
  clearTimeout(reconnectTimer);
  // Full jitter (0-100% of the delay) so a relay restart doesn't get
  // hammered by every client reconnecting on the exact same doubling
  // schedule at once.
  const jittered = Math.random() * reconnectDelay;
  reconnectTimer = setTimeout(connectRelay, jittered);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

function disconnectRelay() {
  manuallyClosed = true;
  clearTimeout(reconnectTimer);
  if (socket) socket.close();
  setConnectionState("offline");
}

async function sendPing(friendPubkey) {
  await queueOutbox(friendPubkey, "ping", {});
  showToast("Ping sent");
}

window.addEventListener("online", () => { if (getRelayUrl() && !manuallyClosed) connectRelay(); });

// ============================= settings UI =============================

document.getElementById("relay-url-input").addEventListener("change", () => {});

document.getElementById("save-relay-url").addEventListener("click", () => {
  const url = document.getElementById("relay-url-input").value.trim();
  if (!url) { disconnectRelay(); setRelayUrl(""); showToast("Relay disconnected"); return; }
  if (!/^wss?:\/\//.test(url)) return showToast("URL must start with ws:// or wss://");
  setRelayUrl(url);
  disconnectRelay();
  connectRelay();
  showToast("Connecting to relay…");
});

(function initSyncUI() {
  document.getElementById("relay-url-input").value = getRelayUrl();
  setConnectionState("offline");
  if (getRelayUrl()) connectRelay();
})();
