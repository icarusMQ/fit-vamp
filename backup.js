/* Backup & restore — the identity-recovery story from the plan
   ("Identity, crypto & backup/recovery"): reinstalling without a backup is
   a brand-new person (friends must re-pair), which is fine as the default,
   but a lot of people will want better. Two paths, same encrypted blob:

     - Local file: PBKDF2(passphrase) -> AES-GCM, saved via the browser's
       normal file-save flow. You hold the only copy and the only key.
     - Google Drive: OAuth PKCE (no client secret — safe for a static
       PWA) against the `drive.appdata` scope, a hidden per-app folder
       Drive gives every app; nothing else in your Drive is touched. Same
       encrypted blob, just uploaded/downloaded instead of saved locally.
       This is WhatsApp's own backup story made literal: "Drive holds an
       encrypted copy, we don't."

   Either way, the plaintext data model this backs up is a straight dump of
   every persistent store *except* `outbox` (a send buffer, not history —
   see its own comment in app.js) — including `identity`, whose CryptoKey
   objects get exported to JWK first since they aren't JSON-serializable. */

const BACKUP_STORES = [
  "exercises", "weightLogs", "workoutLogs", "plans", "friends",
  "leaderboardEvents", "groups", "reports", "courtVideos", "courtVotes", "flagHistory",
];
const PBKDF2_ITERATIONS = 300_000;

// ============================= identity <-> plain object =============================

async function identityToPlain(identity) {
  const [publicKey, privateKey, ecdhPublicKey, ecdhPrivateKey] = await Promise.all([
    crypto.subtle.exportKey("jwk", identity.publicKey),
    crypto.subtle.exportKey("jwk", identity.privateKey),
    crypto.subtle.exportKey("jwk", identity.ecdhPublicKey),
    crypto.subtle.exportKey("jwk", identity.ecdhPrivateKey),
  ]);
  const { publicKey: _pk, privateKey: _sk, ecdhPublicKey: _epk, ecdhPrivateKey: _esk, ...rest } = identity;
  return { ...rest, publicKeyJwk: publicKey, privateKeyJwk: privateKey, ecdhPublicKeyJwk: ecdhPublicKey, ecdhPrivateKeyJwk: ecdhPrivateKey };
}

async function plainToIdentity(plain) {
  const { publicKeyJwk, privateKeyJwk, ecdhPublicKeyJwk, ecdhPrivateKeyJwk, ...rest } = plain;
  const [publicKey, privateKey, ecdhPublicKey, ecdhPrivateKey] = await Promise.all([
    crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]),
    crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]),
    crypto.subtle.importKey("jwk", ecdhPublicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []),
    crypto.subtle.importKey("jwk", ecdhPrivateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]),
  ]);
  return { ...rest, publicKey, privateKey, ecdhPublicKey, ecdhPrivateKey };
}

// ============================= encrypted blob =============================

async function deriveBackupKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function buildBackupPayload() {
  const identity = await getOrCreateIdentity();
  const stores = {};
  for (const s of BACKUP_STORES) stores[s] = await dbGetAll(s);
  return {
    v: 1, exportedAt: Date.now(),
    identity: await identityToPlain(identity),
    stores,
    localStorage: { ...localStorage },
  };
}

async function exportEncryptedBackup(passphrase) {
  const payload = await buildBackupPayload();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, saltBytes);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return JSON.stringify({
    app: "fittrack-backup", v: 1,
    salt: bufToB64Url(saltBytes.buffer), iv: bufToB64Url(iv.buffer), ciphertext: bufToB64Url(ciphertext),
  });
}

async function decryptBackupFile(fileText, passphrase) {
  let file;
  try { file = JSON.parse(fileText); } catch { throw new Error("That doesn't look like a FitTrack backup file."); }
  if (!file || file.app !== "fittrack-backup" || file.v !== 1) throw new Error("That doesn't look like a FitTrack backup file.");
  const key = await deriveBackupKey(passphrase, new Uint8Array(b64UrlToBuf(file.salt)));
  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64UrlToBuf(file.iv)) }, key, b64UrlToBuf(file.ciphertext));
  } catch {
    throw new Error("Wrong passphrase, or the file is corrupted.");
  }
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

// Overwrites this device's identity and every backed-up store with the
// restored data, then reloads — same identity/pubkey as before, so
// friends never notice a change (see the plan's backup section).
async function restoreFromPayload(payload) {
  if (!payload || payload.v !== 1 || !payload.identity || !payload.stores) throw new Error("Unrecognized backup format.");

  for (const storeName of ["identity", ...BACKUP_STORES]) await dbClear(storeName);

  const identityRecord = await plainToIdentity(payload.identity);
  await dbAdd("identity", identityRecord);
  for (const storeName of BACKUP_STORES) {
    for (const row of payload.stores[storeName] || []) await dbAdd(storeName, row);
  }

  localStorage.clear();
  Object.entries(payload.localStorage || {}).forEach(([k, v]) => localStorage.setItem(k, v));

  location.reload();
}
