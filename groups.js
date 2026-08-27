/* Groups — named subsets of your friend list, with two flavors chosen at
   creation (see .claude/plans/social-leaderboards.md, "Decisions locked
   in"):
     - bounded  — joining links you only to that group's existing members.
     - snowball — joining also unions your other snowball groups' rosters
                  with this one's, recursively, bounded to groups this
                  device already knows about.
   Group invites ride the exact same QR/paste flow as 1:1 friend pairing
   (identity.js) — a group invite is just a pairing payload with a `kind`
   discriminator and a roster attached, so scanning one QR can pair you
   with several people and join a group in one step.

   One deliberate simplification vs. the plan's literal wording: instead of
   version-number + lexicographic-id tie-breaking for conflicting concurrent
   merges, roster updates are a pure monotonic set union (never remove a
   member this way — only an explicit revoke does that) and re-broadcast
   whenever a merge actually grows the roster. A grow-only union is
   commutative and idempotent, so it converges to the same result
   regardless of message order or duplicate delivery, without needing exact
   version bookkeeping. */

// ============================= group CRUD =============================

async function createGroup(name, type) {
  const identity = await getOrCreateIdentity();
  const group = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40) || "Group",
    type: type === "snowball" ? "snowball" : "bounded",
    memberPubkeys: [identity.pubkeyB64],
    rosterVersion: 1,
    createdAt: Date.now(),
  };
  await dbPut("groups", group);
  return group;
}

async function leaveGroup(groupId) {
  const group = await dbGet("groups", groupId);
  if (!group) return;
  const identity = await getOrCreateIdentity();
  for (const pubkey of group.memberPubkeys) {
    if (pubkey === identity.pubkeyB64) continue;
    if (typeof queueOutbox === "function") {
      await queueOutbox(pubkey, "revoke", { scope: "group", groupId, targetPubkey: identity.pubkeyB64 });
    }
  }
  await dbDelete("groups", groupId);
}

// ============================= invite payload =============================

// Longer than a 1:1 pairing code's expiry (identity.js) — a group invite is
// more often left open and passed around a room than scanned in one motion.
const GROUP_INVITE_TTL_MS = 60 * 60 * 1000;

// Every current member's {pk, ek, n, t} — the same shape a 1:1 pairing
// payload uses — so the scanner can add each of them as a friend directly.
async function myGroupInvitePayload(groupId) {
  const group = await dbGet("groups", groupId);
  if (!group) throw new Error("Group not found.");
  const members = await resolveGroupMembers(group);
  return JSON.stringify({
    v: 1, kind: "group-invite", groupId: group.id, groupName: group.name,
    groupType: group.type, rosterVersion: group.rosterVersion, members,
    exp: Date.now() + GROUP_INVITE_TTL_MS,
  });
}

// {pk, ek, n, t} for every member this device can actually vouch for — i.e.
// everyone it already knows as itself or a friend. Shared by invites and
// roster-update broadcasts, since both need to hand the recipient enough to
// add a brand-new member as a friend, not just their bare pubkey.
async function resolveGroupMembers(group) {
  const identity = await getOrCreateIdentity();
  const friends = await dbGetAll("friends");
  const friendsByPubkey = new Map(friends.map((f) => [f.pubkey, f]));
  return group.memberPubkeys
    .map((pk) => {
      if (pk === identity.pubkeyB64) return { pk, ek: identity.ecdhPubkeyB64, n: identity.username, t: identity.userTag };
      const f = friendsByPubkey.get(pk);
      return f ? { pk, ek: f.ecdhPubkey, n: f.username, t: f.userTag } : null;
    })
    .filter(Boolean);
}

// ============================= joining =============================

async function joinGroupFromInvite(data) {
  if (typeof data.groupId !== "string" || !Array.isArray(data.members)) throw new Error("Corrupted group invite.");
  if (data.exp && Date.now() > data.exp) throw new Error("This invite has expired — ask for a new one.");
  const identity = await getOrCreateIdentity();

  const addedFriends = [];
  for (const m of data.members) {
    if (m.pk === identity.pubkeyB64) continue;
    const friend = await upsertFriendFromKeys(m);
    if (friend) addedFriends.push(friend);
  }

  const invitePubkeys = [identity.pubkeyB64, ...data.members.map((m) => m.pk)];
  const local = await dbGet("groups", data.groupId);
  const group = {
    id: data.groupId,
    name: data.groupName || local?.name || "Group",
    type: data.groupType || local?.type || "bounded",
    memberPubkeys: [...new Set([...(local?.memberPubkeys || []), ...invitePubkeys])],
    rosterVersion: Math.max(local?.rosterVersion || 0, data.rosterVersion || 0) + 1,
    createdAt: local?.createdAt || Date.now(),
  };
  await dbPut("groups", group);
  await broadcastGroupRoster(group);
  if (group.type === "snowball") await propagateSnowballUnions(group.id);

  return { group, addedFriends };
}

// Dispatcher shared by the QR scanner and paste box (identity.js) — a
// scanned/pasted code is either a 1:1 pairing payload or a group invite;
// this is the one place that decides which.
async function importFromScannedPayload(raw) {
  let data;
  try { data = JSON.parse(raw.trim()); } catch { throw new Error("That doesn't look like a FitTrack code."); }
  if (!data || data.v !== 1) throw new Error("That doesn't look like a FitTrack code.");

  if (data.kind === "group-invite") {
    const { group } = await joinGroupFromInvite(data);
    return { toastMessage: `Joined "${group.name}"` };
  }

  // Not a group invite -> a 1:1 pairing code; importFriendFromPayload
  // (identity.js) does its own parsing, so hand it the raw text rather
  // than duplicating the same validation/expiry/upsert logic here.
  const friend = await importFriendFromPayload(raw);
  return { toastMessage: `Added ${friend.username}#${friend.userTag}` };
}

// ============================= roster sync =============================
//
// Broadcasts carry full {pk,ek,n,t} member tuples, not bare pubkeys — a
// roster update is often the *only* introduction an existing member ever
// gets to a brand-new joiner (they never scanned that person's code
// directly), so it has to double as a friend-pairing message too.

// Shared by anything that needs to fan a message out to every other member
// of a group — roster updates here, reports/court videos/votes in
// moderation.js.
async function broadcastToGroup(group, type, data) {
  const identity = await getOrCreateIdentity();
  for (const pubkey of group.memberPubkeys) {
    if (pubkey === identity.pubkeyB64) continue;
    if (typeof queueOutbox === "function") await queueOutbox(pubkey, type, data);
  }
}

async function broadcastGroupRoster(group) {
  const members = await resolveGroupMembers(group);
  const payload = { id: group.id, name: group.name, type: group.type, rosterVersion: group.rosterVersion, members };
  await broadcastToGroup(group, "group-roster", payload);
}

async function applyIncomingGroupRoster(incoming) {
  if (!incoming || typeof incoming.id !== "string" || !Array.isArray(incoming.members)) return;
  const identity = await getOrCreateIdentity();
  const incomingPubkeys = incoming.members.map((m) => m.pk);
  if (!incomingPubkeys.includes(identity.pubkeyB64)) return; // not a roster we're part of

  for (const m of incoming.members) {
    if (m.pk === identity.pubkeyB64) continue;
    await upsertFriendFromKeys(m); // introduces any member we haven't met yet
  }

  const local = await dbGet("groups", incoming.id);
  const mergedMembers = [...new Set([...(local?.memberPubkeys || []), ...incomingPubkeys])];
  const grew = !local || mergedMembers.length > local.memberPubkeys.length;
  const record = {
    id: incoming.id,
    name: incoming.name || local?.name || "Group",
    type: incoming.type || local?.type || "bounded",
    memberPubkeys: mergedMembers,
    rosterVersion: Math.max(local?.rosterVersion || 0, incoming.rosterVersion || 0) + (grew ? 1 : 0),
    createdAt: local?.createdAt || Date.now(),
  };
  await dbPut("groups", record);
  if (grew) {
    await broadcastGroupRoster(record); // pass the merge along in case others haven't heard yet
    if (record.type === "snowball") await propagateSnowballUnions(record.id);
  }
}

async function applyIncomingRevoke(data) {
  const group = await dbGet("groups", data.groupId);
  if (!group || !group.memberPubkeys.includes(data.targetPubkey)) return;
  group.memberPubkeys = group.memberPubkeys.filter((pk) => pk !== data.targetPubkey);
  group.rosterVersion = (group.rosterVersion || 0) + 1;
  await dbPut("groups", group);
}

// Union-find over locally known snowball groups: repeatedly merge any two
// snowball groups that share a member, until nothing changes. Bounded by
// however many snowball groups this device knows about — it never reaches
// out to discover groups it has no member overlap with.
async function propagateSnowballUnions(changedGroupId) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    const groups = await dbGetAll("groups");
    const changed = groups.find((g) => g.id === changedGroupId);
    if (!changed || changed.type !== "snowball") return;

    for (const g of groups) {
      if (g.id === changedGroupId || g.type !== "snowball") continue;
      const overlaps = g.memberPubkeys.some((pk) => changed.memberPubkeys.includes(pk));
      if (!overlaps) continue;
      const union = [...new Set([...g.memberPubkeys, ...changed.memberPubkeys])];
      if (union.length === g.memberPubkeys.length && union.length === changed.memberPubkeys.length) continue;

      g.memberPubkeys = union; g.rosterVersion = (g.rosterVersion || 0) + 1;
      changed.memberPubkeys = union; changed.rosterVersion = (changed.rosterVersion || 0) + 1;
      await dbPut("groups", g);
      await dbPut("groups", changed);
      await broadcastGroupRoster(g);
      await broadcastGroupRoster(changed);
      progressed = true;
    }
  }
}

// ============================= Groups tab =============================

async function renderGroupsTab() {
  const groups = (await dbGetAll("groups")).sort((a, b) => a.createdAt - b.createdAt);
  const list = document.getElementById("groups-list");
  list.innerHTML = "";
  if (!groups.length) {
    list.innerHTML = `<li class="empty-state">No groups yet — tap + New to create one.</li>`;
    return;
  }
  groups.forEach((g) => {
    const li = document.createElement("li");
    li.className = "entry-item";
    li.innerHTML = `<div class="entry-main">
      <span class="entry-title">${escapeHtml(g.name)} <span class="group-type-badge group-type-${g.type}">${g.type}</span></span>
      <span class="entry-sub">${g.memberPubkeys.length} member${g.memberPubkeys.length === 1 ? "" : "s"}</span>
    </div>
    <button class="btn btn-ghost btn-sm group-members-btn">Members</button>
    <button class="btn btn-ghost btn-sm group-invite-btn">Invite</button>
    <button class="btn btn-ghost btn-sm group-leave-btn">Leave</button>`;
    li.querySelector(".group-members-btn").addEventListener("click", () => { SFX.swipe(); openGroupMembersModal(g.id); });
    li.querySelector(".group-invite-btn").addEventListener("click", () => { SFX.swipe(); openGroupInviteModal(g.id); });
    li.querySelector(".group-leave-btn").addEventListener("click", async () => {
      SFX.tap();
      await leaveGroup(g.id);
      showToast(`Left "${g.name}"`);
      refreshCurrentTab();
    });
    list.appendChild(li);
  });
}

async function openGroupInviteModal(groupId) {
  const payload = await myGroupInvitePayload(groupId);
  document.getElementById("group-invite-code-text").value = payload;
  renderQrSvgInto("group-invite-qr-holder", payload);
  openModal("modal-group-invite");
}

let newGroupType = "bounded";
document.getElementById("btn-new-group").addEventListener("click", () => {
  document.getElementById("new-group-name-input").value = "";
  newGroupType = "bounded";
  document.querySelectorAll(".group-type-opt").forEach((o) => o.classList.toggle("group-type-active", o.dataset.groupType === "bounded"));
  openModal("modal-new-group");
});
document.querySelectorAll(".group-type-opt").forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll(".group-type-opt").forEach((o) => o.classList.remove("group-type-active"));
    opt.classList.add("group-type-active");
    newGroupType = opt.dataset.groupType;
  });
});
document.getElementById("save-new-group").addEventListener("click", async () => {
  const name = document.getElementById("new-group-name-input").value;
  if (!name.trim()) return showToast("Enter a group name");
  const group = await createGroup(name, newGroupType);
  closeModal("modal-new-group");
  showToast(`Created "${group.name}"`);
  refreshCurrentTab();
  await openGroupInviteModal(group.id); // share it immediately
});
document.getElementById("btn-copy-group-code").addEventListener("click", async () => {
  const text = document.getElementById("group-invite-code-text").value;
  try { await navigator.clipboard.writeText(text); SFX.copy(); showToast("Code copied"); }
  catch { showToast("Couldn't copy — select the text manually"); }
});
