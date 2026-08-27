/* Red Flag Court UI — the group members list, reporting, voting, and the
   defense-video recorder. Logic and state live in moderation.js; this file
   is purely rendering and DOM wiring, same split as groups.js/groups
   UI. */

let currentModerationGroupId = null;
let reportTargetPubkey = null;
let defenseGroupId = null;

async function openGroupMembersModal(groupId) {
  currentModerationGroupId = groupId;
  await renderGroupMembersModal();
  openModal("modal-group-members");
}

async function renderGroupMembersModal() {
  const groupId = currentModerationGroupId;
  const group = await dbGet("groups", groupId);
  if (!group) return;
  document.getElementById("group-members-title").textContent = group.name;

  const identity = await getOrCreateIdentity();
  const friends = await dbGetAll("friends");
  const friendsByPubkey = new Map(friends.map((f) => [f.pubkey, f]));
  const nameFor = (pk) => (pk === identity.pubkeyB64
    ? displayNameOf(identity)
    : friendsByPubkey.has(pk) ? `${friendsByPubkey.get(pk).username}#${friendsByPubkey.get(pk).userTag}` : "Unknown");

  const list = document.getElementById("group-members-list");
  list.innerHTML = "";

  for (const pk of group.memberPubkeys) {
    const isMe = pk === identity.pubkeyB64;
    const status = await flagStatusFor(pk, groupId);
    const consequential = status && (status.status === "pending" || status.status === "upheld");

    const li = document.createElement("li");
    li.className = "entry-item mod-member-row";
    const statusLine = status
      ? `<span class="entry-sub">${status.tally.clear} clear / ${status.tally.uphold} uphold${status.status === "pending" ? ` · court ends ${new Date(status.deadline).toLocaleDateString()}` : ` · ${status.status}`}</span>`
      : "";
    li.innerHTML = `<div class="entry-main">
      <span class="entry-title">${escapeHtml(nameFor(pk))}${isMe ? " (you)" : ""}${consequential ? ` <span class="group-type-badge group-type-snowball">🚩 flagged</span>` : ""}</span>
      ${statusLine}
    </div>`;

    const actions = document.createElement("div");
    actions.className = "mod-member-actions";
    if (isMe) {
      if (status && status.status === "pending") {
        const btn = document.createElement("button");
        btn.className = "btn btn-danger btn-sm";
        btn.textContent = "Record Defense";
        btn.addEventListener("click", () => openDefenseRecorder(groupId));
        actions.appendChild(btn);
      }
    } else if (status && status.status === "pending") {
      const clearBtn = document.createElement("button");
      clearBtn.className = "btn btn-ghost btn-sm";
      clearBtn.textContent = "Vote Clear";
      clearBtn.addEventListener("click", async () => {
        SFX.tap();
        try { await submitCourtVote(pk, groupId, "clear"); showToast("Vote recorded"); await renderGroupMembersModal(); }
        catch (err) { showToast(err.message); }
      });
      const upholdBtn = document.createElement("button");
      upholdBtn.className = "btn btn-ghost btn-sm";
      upholdBtn.textContent = "Vote Uphold";
      upholdBtn.addEventListener("click", async () => {
        SFX.tap();
        try { await submitCourtVote(pk, groupId, "uphold"); showToast("Vote recorded"); await renderGroupMembersModal(); }
        catch (err) { showToast(err.message); }
      });
      actions.appendChild(clearBtn);
      actions.appendChild(upholdBtn);

      const video = await dbGet("courtVideos", `${pk}:${groupId}`);
      if (video) {
        const watchBtn = document.createElement("button");
        watchBtn.className = "btn btn-ghost btn-sm";
        watchBtn.textContent = "Watch Defense";
        watchBtn.addEventListener("click", async () => {
          try {
            const url = await getCourtVideoUrl(video.key);
            window.open(url, "_blank", "noopener");
          } catch (err) { showToast(err.message); }
        });
        actions.appendChild(watchBtn);
      }
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost btn-sm";
      btn.textContent = "Report";
      btn.addEventListener("click", () => openReportModal(pk, groupId));
      actions.appendChild(btn);
    }
    li.appendChild(actions);
    list.appendChild(li);
  }
}

// ============================= report modal =============================

function openReportModal(targetPubkey, groupId) {
  reportTargetPubkey = targetPubkey;
  currentModerationGroupId = groupId;
  document.getElementById("report-reason-input").value = "";
  openModal("modal-report-reason");
}

document.getElementById("submit-report").addEventListener("click", async () => {
  const reason = document.getElementById("report-reason-input").value;
  try {
    await submitReport(reportTargetPubkey, currentModerationGroupId, reason);
    SFX.tap();
    showToast("Report submitted");
    closeModal("modal-report-reason");
    await renderGroupMembersModal();
  } catch (err) {
    showToast(err.message || "Couldn't submit report");
  }
});

// ============================= defense recorder =============================

let defenseStream = null;
let defenseRecorder = null;
let defenseChunks = [];

function openDefenseRecorder(groupId) {
  defenseGroupId = groupId;
  defenseChunks = [];
  const video = document.getElementById("defense-video-preview");
  video.classList.add("hidden");
  video.srcObject = null;
  document.getElementById("defense-status").textContent = "";
  document.getElementById("btn-toggle-defense-recording").textContent = "Start Recording";
  document.getElementById("btn-submit-defense").classList.add("hidden");
  openModal("modal-defense-recorder");
}

function stopDefenseStream() {
  if (defenseStream) defenseStream.getTracks().forEach((t) => t.stop());
  defenseStream = null;
}

document.getElementById("btn-toggle-defense-recording").addEventListener("click", async () => {
  const statusEl = document.getElementById("defense-status");
  const video = document.getElementById("defense-video-preview");
  const toggleBtn = document.getElementById("btn-toggle-defense-recording");

  if (defenseRecorder && defenseRecorder.state === "recording") {
    defenseRecorder.stop();
    return;
  }

  try {
    defenseStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    statusEl.textContent = "Camera/mic unavailable.";
    return;
  }
  video.srcObject = defenseStream;
  video.muted = true;
  video.classList.remove("hidden");
  await video.play();

  defenseChunks = [];
  defenseRecorder = new MediaRecorder(defenseStream, { mimeType: "video/webm" });
  defenseRecorder.ondataavailable = (e) => { if (e.data.size > 0) defenseChunks.push(e.data); };
  defenseRecorder.onstop = () => {
    stopDefenseStream();
    toggleBtn.textContent = "Record Again";
    document.getElementById("btn-submit-defense").classList.remove("hidden");
  };
  defenseRecorder.start();
  toggleBtn.textContent = "Stop Recording";
});

document.getElementById("btn-submit-defense").addEventListener("click", async () => {
  const statusEl = document.getElementById("defense-status");
  if (!defenseChunks.length) return showToast("Record a video first");
  statusEl.textContent = "Uploading…";
  try {
    const blob = new Blob(defenseChunks, { type: "video/webm" });
    const key = await uploadCourtVideo(blob, defenseGroupId);
    const identity = await getOrCreateIdentity();
    await recordCourtVideo(identity.pubkeyB64, defenseGroupId, key);
    statusEl.textContent = "Submitted.";
    SFX.log();
    showToast("Defense submitted");
    closeModal("modal-defense-recorder");
    refreshCurrentTab();
  } catch (err) {
    statusEl.textContent = err.message || "Upload failed.";
  }
});

document.querySelector('[data-close="modal-defense-recorder"]').addEventListener("click", stopDefenseStream);
document.getElementById("modal-defense-recorder").addEventListener("click", (e) => {
  if (e.target.id === "modal-defense-recorder") stopDefenseStream();
});

// ============================= court upload endpoint setting =============================

document.getElementById("save-court-endpoint").addEventListener("click", () => {
  const url = document.getElementById("court-endpoint-input").value.trim();
  setCourtEndpoint(url);
  showToast(url ? "Court endpoint saved" : "Court endpoint cleared");
});

document.getElementById("court-endpoint-input").value = getCourtEndpoint();
