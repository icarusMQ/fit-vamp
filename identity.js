/* Identity, QR pairing, and friends — the local half of the social-leaderboards
   feature (see .claude/plans/social-leaderboards.md). Nothing in this file
   makes a network call: pairing is device-to-device via a QR code or a
   pasted text code. The relay/sync step is a later addition. */

// ============================= crypto / identity =============================

function bufToB64Url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64UrlToBuf(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function randomTag() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let tag = "";
  for (let i = 0; i < 4; i++) tag += chars[Math.floor(Math.random() * chars.length)];
  return tag;
}

let identityCache = null;

// Generates this device's pairing keypairs on first run. Two separate P-256
// keypairs, not one: ECDSA signs (proves "this really came from me" — used
// for the relay auth handshake and, later, event authorship), ECDH agrees on
// a shared secret for encryption (a key generated for signing can't be used
// to derive a shared secret, and vice versa). P-256 over Ed25519/X25519
// because WebCrypto support for it is universal across browsers, where the
// newer curves are still inconsistently supported as of this writing.
async function getOrCreateIdentity() {
  if (identityCache) return identityCache;
  let record = await dbGet("identity", 1);
  if (record) {
    if (!record.ecdhPrivateKey) await backfillEcdhKeypair(record);
    identityCache = record;
    return record;
  }

  const signKeyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );
  const ecdhKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
  const rawPub = await crypto.subtle.exportKey("raw", signKeyPair.publicKey);
  const rawEcdhPub = await crypto.subtle.exportKey("raw", ecdhKeyPair.publicKey);
  record = {
    id: 1,
    publicKey: signKeyPair.publicKey,
    privateKey: signKeyPair.privateKey,
    pubkeyB64: bufToB64Url(rawPub),
    ecdhPublicKey: ecdhKeyPair.publicKey,
    ecdhPrivateKey: ecdhKeyPair.privateKey,
    ecdhPubkeyB64: bufToB64Url(rawEcdhPub),
    deviceId: crypto.randomUUID(),
    username: "Athlete",
    userTag: randomTag(),
  };
  await dbAdd("identity", record);
  identityCache = record;
  return record;
}

// Only reachable for an identity created before ECDH keys existed — none in
// production yet, but keeps local dev DBs from step 2 working without a
// manual reset.
async function backfillEcdhKeypair(record) {
  const ecdhKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
  const rawEcdhPub = await crypto.subtle.exportKey("raw", ecdhKeyPair.publicKey);
  record.ecdhPublicKey = ecdhKeyPair.publicKey;
  record.ecdhPrivateKey = ecdhKeyPair.privateKey;
  record.ecdhPubkeyB64 = bufToB64Url(rawEcdhPub);
  await dbPut("identity", record);
}

async function setUsername(name) {
  const identity = await getOrCreateIdentity();
  identity.username = name.trim().slice(0, 24) || "Athlete";
  await dbPut("identity", identity);
  identityCache = identity;
  return identity;
}

// Gender and height are optional, self-reported, and only ever shared with
// paired friends (end-to-end encrypted, never sent to the relay in the
// clear) — used solely for the demographic leaderboard slices. Leaving them
// unset keeps you in "Everyone" boards only.
async function setProfile({ genderSelf, heightCm }) {
  const identity = await getOrCreateIdentity();
  identity.genderSelf = genderSelf || undefined;
  identity.heightCm = heightCm > 0 ? heightCm : undefined;
  await dbPut("identity", identity);
  identityCache = identity;
  if (typeof broadcastToAllFriends === "function") {
    await broadcastToAllFriends("profile-update", { genderSelf: identity.genderSelf, heightCm: identity.heightCm });
  }
  return identity;
}

function displayNameOf(record) { return `${record.username}#${record.userTag}`; }

// ============================= pairing payload =============================

// Friend-pairing QR/codes are meant for an immediate, in-person scan — a
// short expiry means an old code left visible in a screenshot or a photo
// can't be used to pair with you later. Group invites get a longer window
// (groups.js) since those are more often passed around a room.
const FRIEND_INVITE_TTL_MS = 10 * 60 * 1000;

async function myPairingPayload() {
  const identity = await getOrCreateIdentity();
  return JSON.stringify({
    v: 1, kind: "friend", pk: identity.pubkeyB64, ek: identity.ecdhPubkeyB64, n: identity.username, t: identity.userTag,
    exp: Date.now() + FRIEND_INVITE_TTL_MS,
  });
}

// Shared by 1:1 pairing and group-join (a group invite carries one of these
// per existing member) — validates a {pk, ek, n, t} tuple and upserts it
// into the local friends store. Throws on anything that isn't a real P-256
// key pair, so a malformed or tampered invite fails loudly instead of
// silently creating a friend link the crypto can't actually back.
async function upsertFriendFromKeys({ pk, ek, n, t }) {
  if (typeof pk !== "string" || typeof ek !== "string" || typeof n !== "string") {
    throw new Error("That doesn't look like a FitTrack code.");
  }
  const identity = await getOrCreateIdentity();
  if (pk === identity.pubkeyB64) return null; // it's you — nothing to add

  try {
    await crypto.subtle.importKey("raw", b64UrlToBuf(pk), { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    await crypto.subtle.importKey("raw", b64UrlToBuf(ek), { name: "ECDH", namedCurve: "P-256" }, true, []);
  } catch { throw new Error("Corrupted code."); }

  const existing = await dbGet("friends", pk);
  const friend = {
    pubkey: pk,
    ecdhPubkey: ek,
    username: n,
    userTag: t || "",
    genderSelf: existing?.genderSelf,
    heightCm: existing?.heightCm,
    addedAt: existing?.addedAt || Date.now(),
  };
  await dbPut("friends", friend);
  return friend;
}

async function importFriendFromPayload(raw) {
  let data;
  try { data = JSON.parse(raw.trim()); } catch { throw new Error("That doesn't look like a FitTrack code."); }
  if (!data || data.v !== 1) throw new Error("That doesn't look like a FitTrack code.");
  if (data.exp && Date.now() > data.exp) throw new Error("This code has expired — ask for a new one.");
  const identity = await getOrCreateIdentity();
  if (data.pk === identity.pubkeyB64) throw new Error("That's your own code.");
  const friend = await upsertFriendFromKeys(data);
  if (!friend) throw new Error("That's your own code.");
  return friend;
}

// Removes a friend from this device only — doesn't touch any shared group's
// roster (leaving a specific group is a separate action, see groups.js).
// Notifies them so their device can reciprocally remove you too.
async function removeFriend(pubkey) {
  const identity = await getOrCreateIdentity();
  if (typeof queueOutbox === "function") {
    await queueOutbox(pubkey, "revoke", { scope: "friend", targetPubkey: identity.pubkeyB64, actorPubkey: identity.pubkeyB64 });
  }
  await dbDelete("friends", pubkey);
  const events = await dbGetAll("leaderboardEvents");
  for (const e of events) if (e.authorPubkey === pubkey) await dbDelete("leaderboardEvents", e.id);
}

// ============================= Friends tab =============================

async function renderFriendsTab() {
  const identity = await getOrCreateIdentity();
  document.getElementById("my-identity-name").textContent = displayNameOf(identity);

  const friends = (await dbGetAll("friends")).sort((a, b) => a.addedAt - b.addedAt);
  const list = document.getElementById("friends-list");
  list.innerHTML = "";
  if (!friends.length) {
    list.innerHTML = `<li class="empty-state">No friends yet — tap + Add to pair a device.</li>`;
    return;
  }
  friends.forEach((f) => {
    const li = document.createElement("li");
    li.className = "entry-item";
    li.innerHTML = `<div class="entry-main">
      <span class="entry-title friend-row-name">${escapeHtml(f.username)}#${escapeHtml(f.userTag)}</span>
      <span class="entry-sub friend-row-sub">${escapeHtml(f.pubkey.slice(0, 10))}…</span>
    </div>
    <button class="btn btn-ghost btn-sm friend-ping-btn">Ping</button>
    <button class="btn btn-ghost btn-sm friend-remove-btn">Remove</button>`;
    li.querySelector(".friend-ping-btn").addEventListener("click", () => { SFX.tap(); sendPing(f.pubkey); });
    li.querySelector(".friend-remove-btn").addEventListener("click", async () => {
      SFX.tap();
      await removeFriend(f.pubkey);
      showToast(`Removed ${f.username}#${f.userTag}`);
      refreshCurrentTab();
    });
    list.appendChild(li);
  });
}

// ============================= Add Friend modal =============================

function switchFriendTab(name) {
  document.querySelectorAll(".friend-tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.friendTab === name));
  document.getElementById("friend-tab-mycode").classList.toggle("hidden", name !== "mycode");
  document.getElementById("friend-tab-scan").classList.toggle("hidden", name !== "scan");
  if (name !== "scan") stopScan();
}

// Shared by the personal pairing QR and (in groups.js) group-invite QRs.
function renderQrSvgInto(containerId, payload) {
  const qr = qrcode(0, "M");
  qr.addData(payload, "Byte");
  qr.make();
  document.getElementById(containerId).innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4 });
}

async function renderMyQR() {
  const payload = await myPairingPayload();
  document.getElementById("my-code-text").value = payload;
  renderQrSvgInto("my-qr-holder", payload);
}

document.getElementById("btn-add-friend").addEventListener("click", async () => {
  SFX.swipe();
  switchFriendTab("mycode");
  await renderMyQR();
  openModal("modal-add-friend");
});

document.querySelectorAll(".friend-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => { SFX.tap(); switchFriendTab(btn.dataset.friendTab); });
});

document.getElementById("btn-copy-code").addEventListener("click", async () => {
  const text = document.getElementById("my-code-text").value;
  try {
    await navigator.clipboard.writeText(text);
    SFX.copy();
    showToast("Code copied");
  } catch {
    showToast("Couldn't copy — select the text manually");
  }
});

document.getElementById("btn-submit-pasted-code").addEventListener("click", async () => {
  const raw = document.getElementById("paste-code-input").value;
  if (!raw.trim()) return showToast("Paste a code first");
  try {
    const { toastMessage } = await importFromScannedPayload(raw);
    SFX.log();
    showToast(toastMessage);
    document.getElementById("paste-code-input").value = "";
    stopScan();
    closeModal("modal-add-friend");
    refreshCurrentTab();
  } catch (err) {
    showToast(err.message || "Couldn't add that code");
  }
});

// ---- camera scan (jsQR) ----
let scanStream = null;
let scanRafId = null;

async function startScan() {
  const video = document.getElementById("scan-video");
  const statusEl = document.getElementById("scan-status");
  statusEl.classList.add("hidden");
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch {
    statusEl.textContent = "Camera unavailable — paste a code instead.";
    statusEl.classList.remove("hidden");
    return;
  }
  video.srcObject = scanStream;
  video.classList.remove("hidden");
  await video.play();
  document.getElementById("btn-toggle-scan").textContent = "Stop Camera";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tick = () => {
    if (!scanStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);
      if (code && code.data) {
        onScanSuccess(code.data);
        return;
      }
    }
    scanRafId = requestAnimationFrame(tick);
  };
  scanRafId = requestAnimationFrame(tick);
}

function stopScan() {
  if (scanRafId) cancelAnimationFrame(scanRafId);
  scanRafId = null;
  if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
  scanStream = null;
  const video = document.getElementById("scan-video");
  video.classList.add("hidden");
  video.srcObject = null;
  document.getElementById("btn-toggle-scan").textContent = "Start Camera";
}

async function onScanSuccess(raw) {
  stopScan();
  try {
    const { toastMessage } = await importFromScannedPayload(raw);
    SFX.log();
    showToast(toastMessage);
    closeModal("modal-add-friend");
    refreshCurrentTab();
  } catch (err) {
    showToast(err.message || "Couldn't add that code");
  }
}

document.getElementById("btn-toggle-scan").addEventListener("click", () => {
  if (scanStream) stopScan(); else startScan();
});

// close the modal via the header ✕ / overlay click should also stop the camera
document.querySelector('[data-close="modal-add-friend"]').addEventListener("click", stopScan);
document.getElementById("modal-add-friend").addEventListener("click", (e) => {
  if (e.target.id === "modal-add-friend") stopScan();
});

// ============================= edit profile =============================

document.getElementById("btn-edit-username").addEventListener("click", async () => {
  SFX.swipe();
  const identity = await getOrCreateIdentity();
  document.getElementById("edit-username-input").value = identity.username;
  document.getElementById("edit-height-input").value = identity.heightCm || "";
  document.querySelectorAll(".gender-opt").forEach((o) => o.classList.toggle("gender-active", o.dataset.gender === (identity.genderSelf || "")));
  openModal("modal-edit-username");
});

document.querySelectorAll(".gender-opt").forEach((opt) => {
  opt.addEventListener("click", () => {
    const alreadyOn = opt.classList.contains("gender-active");
    document.querySelectorAll(".gender-opt").forEach((o) => o.classList.remove("gender-active"));
    if (!alreadyOn) opt.classList.add("gender-active"); // tap again to clear back to "prefer not to say"
  });
});

document.getElementById("save-username").addEventListener("click", async () => {
  const name = document.getElementById("edit-username-input").value;
  if (!name.trim()) return showToast("Enter a name");
  const genderOpt = document.querySelector(".gender-opt.gender-active");
  const heightCm = parseFloat(document.getElementById("edit-height-input").value) || undefined;
  await setUsername(name);
  await setProfile({ genderSelf: genderOpt ? genderOpt.dataset.gender : undefined, heightCm });
  closeModal("modal-edit-username");
  showToast("Profile updated");
  refreshCurrentTab();
});
