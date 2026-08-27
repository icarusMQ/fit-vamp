/* Google Drive backup — OAuth PKCE (no client secret, safe for a static
   PWA) against the `drive.appdata` scope: a hidden per-app folder Drive
   gives every app, invisible in the user's normal Drive UI and untouched
   by anything else. Same encrypted blob as a local backup.js export, just
   uploaded/downloaded instead of saved to disk — this is WhatsApp's own
   backup story made literal ("Drive holds an encrypted copy, we don't").

   Requires a Google OAuth client id the user creates themselves (Google
   Cloud Console -> APIs & Services -> Credentials -> OAuth client ID ->
   "Web application", with this app's URL as an authorized JavaScript
   origin AND redirect URI, and the Drive API enabled on the project) —
   there's no way to provision that from here, so it's a setting
   (Friends -> Backup), same pattern as the relay URL and court endpoint. */

const DRIVE_CLIENT_ID_LS_KEY = "ft_drive_client_id";
const DRIVE_TOKENS_LS_KEY = "ft_drive_tokens";
const DRIVE_VERIFIER_SESSION_KEY = "ft_drive_pkce_verifier";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_BACKUP_FILENAME = "fittrack-backup.json";

function getDriveClientId() { return localStorage.getItem(DRIVE_CLIENT_ID_LS_KEY) || ""; }
function setDriveClientId(id) { localStorage.setItem(DRIVE_CLIENT_ID_LS_KEY, id.trim()); }

function getDriveTokens() { try { return JSON.parse(localStorage.getItem(DRIVE_TOKENS_LS_KEY) || "null"); } catch { return null; } }
function setDriveTokens(tokens) { localStorage.setItem(DRIVE_TOKENS_LS_KEY, JSON.stringify(tokens)); }
function clearDriveTokens() { localStorage.removeItem(DRIVE_TOKENS_LS_KEY); }
function isDriveConnected() { return !!getDriveTokens(); }

// ============================= PKCE =============================

function randomCodeVerifier() {
  return bufToB64Url(crypto.getRandomValues(new Uint8Array(32)).buffer); // 43 chars, valid PKCE charset
}
async function codeChallengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bufToB64Url(digest);
}

function driveRedirectUri() { return location.origin + location.pathname; }

async function startDriveAuth() {
  const clientId = getDriveClientId();
  if (!clientId) throw new Error("Set a Google OAuth client id first (Friends → Backup).");
  const verifier = randomCodeVerifier();
  sessionStorage.setItem(DRIVE_VERIFIER_SESSION_KEY, verifier);
  const challenge = await codeChallengeFromVerifier(verifier);
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: driveRedirectUri(), response_type: "code",
    scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent",
    code_challenge: challenge, code_challenge_method: "S256",
  });
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Call once at boot: finishes the PKCE exchange if we just landed back here
// with ?code=... in the URL, and strips it either way so a refresh doesn't
// try to redeem the same code twice.
async function completeDriveAuthIfRedirected() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (!code) return false;
  const verifier = sessionStorage.getItem(DRIVE_VERIFIER_SESSION_KEY);
  sessionStorage.removeItem(DRIVE_VERIFIER_SESSION_KEY);
  history.replaceState({}, "", driveRedirectUri());
  if (!verifier) throw new Error("Google sign-in session expired — try connecting again.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getDriveClientId(), code, redirect_uri: driveRedirectUri(),
      grant_type: "authorization_code", code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error("Google sign-in failed.");
  const tokens = await res.json();
  setDriveTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + tokens.expires_in * 1000 });
  return true;
}

async function driveAccessToken() {
  const tokens = getDriveTokens();
  if (!tokens) throw new Error("Not connected to Google Drive.");
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: getDriveClientId(), refresh_token: tokens.refresh_token, grant_type: "refresh_token" }),
  });
  if (!res.ok) { clearDriveTokens(); throw new Error("Google Drive session expired — reconnect."); }
  const refreshed = await res.json();
  const updated = { ...tokens, access_token: refreshed.access_token, expires_at: Date.now() + refreshed.expires_in * 1000 };
  setDriveTokens(updated);
  return updated.access_token;
}

// ============================= Drive appDataFolder I/O =============================

async function findDriveBackupFileId(accessToken) {
  const q = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}'`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Couldn't reach Google Drive.");
  const { files } = await res.json();
  return files && files.length ? files[0].id : null;
}

async function backupToDrive(passphrase) {
  const accessToken = await driveAccessToken();
  const blob = await exportEncryptedBackup(passphrase);
  const existingId = await findDriveBackupFileId(accessToken);

  const metadata = existingId ? {} : { name: DRIVE_BACKUP_FILENAME, parents: ["appDataFolder"] };
  const boundary = "fittrack-" + crypto.randomUUID();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${blob}\r\n--${boundary}--`;
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error("Upload to Google Drive failed.");
}

async function restoreFromDrive(passphrase) {
  const accessToken = await driveAccessToken();
  const fileId = await findDriveBackupFileId(accessToken);
  if (!fileId) throw new Error("No FitTrack backup found in Google Drive.");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Couldn't download the backup from Google Drive.");
  const payload = await decryptBackupFile(await res.text(), passphrase);
  await restoreFromPayload(payload);
}
