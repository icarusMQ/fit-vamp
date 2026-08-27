/* Backup UI — wiring for backup.js (local encrypted file) and
   drive-backup.js (Google Drive). One shared passphrase modal drives all
   four flows (export/restore x local/Drive) via a mode flag, same pattern
   as moderation-ui.js's report modal. */

let backupMode = null; // export-local | restore-local | backup-drive | restore-drive
let pendingRestoreFileText = null;

function openBackupPassphraseModal(mode, title) {
  backupMode = mode;
  document.getElementById("backup-passphrase-title").textContent = title;
  document.getElementById("backup-passphrase-input").value = "";
  document.getElementById("backup-passphrase-status").textContent = "";
  openModal("modal-backup-passphrase");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById("btn-export-backup").addEventListener("click", () => {
  SFX.swipe();
  openBackupPassphraseModal("export-local", "Choose a Passphrase");
});

document.getElementById("btn-restore-backup").addEventListener("click", () => {
  document.getElementById("backup-file-input").click();
});
document.getElementById("backup-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = ""; // so picking the same file twice still fires change
  if (!file) return;
  pendingRestoreFileText = await file.text();
  openBackupPassphraseModal("restore-local", "Enter Backup Passphrase");
});

document.getElementById("btn-backup-drive").addEventListener("click", () => {
  SFX.swipe();
  openBackupPassphraseModal("backup-drive", "Choose a Passphrase");
});
document.getElementById("btn-restore-drive").addEventListener("click", () => {
  SFX.swipe();
  openBackupPassphraseModal("restore-drive", "Enter Backup Passphrase");
});

document.getElementById("backup-passphrase-continue").addEventListener("click", async () => {
  const passphrase = document.getElementById("backup-passphrase-input").value;
  const statusEl = document.getElementById("backup-passphrase-status");
  if (!passphrase || passphrase.length < 6) { statusEl.textContent = "Use at least 6 characters."; return; }
  statusEl.textContent = "Working…";
  try {
    if (backupMode === "export-local") {
      const blob = await exportEncryptedBackup(passphrase);
      downloadTextFile("fittrack-backup.json", blob);
      SFX.log();
      showToast("Backup downloaded");
      closeModal("modal-backup-passphrase");
    } else if (backupMode === "restore-local") {
      const payload = await decryptBackupFile(pendingRestoreFileText, passphrase);
      await restoreFromPayload(payload); // reloads the page on success
    } else if (backupMode === "backup-drive") {
      await backupToDrive(passphrase);
      SFX.log();
      showToast("Backed up to Google Drive");
      closeModal("modal-backup-passphrase");
    } else if (backupMode === "restore-drive") {
      await restoreFromDrive(passphrase); // reloads on success
    }
  } catch (err) {
    statusEl.textContent = err.message || "Something went wrong.";
  }
});

// ============================= Google Drive connect =============================

document.getElementById("btn-connect-drive").addEventListener("click", async () => {
  try { await startDriveAuth(); } catch (err) { showToast(err.message); }
});
document.getElementById("btn-disconnect-drive").addEventListener("click", () => {
  clearDriveTokens();
  renderBackupCard();
  showToast("Disconnected from Google Drive");
});
document.getElementById("save-drive-client-id").addEventListener("click", () => {
  setDriveClientId(document.getElementById("drive-client-id-input").value);
  showToast("Client ID saved");
});

function renderBackupCard() {
  document.getElementById("drive-client-id-input").value = getDriveClientId();
  const connected = isDriveConnected();
  document.getElementById("drive-connect-row").classList.toggle("hidden", connected);
  document.getElementById("drive-connected-row").classList.toggle("hidden", !connected);
}
renderBackupCard();
