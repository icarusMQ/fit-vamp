/* Leaderboards tab + home-page "best placements" resume — ranks this
   device's own Drops history against paired friends' cached events
   (drops.js has the pure aggregation + window/bracket functions). Reading a
   leaderboard never makes a network call: it's a computation over the
   local leaderboardEvents cache, which sync.js keeps up to date in the
   background. Every leaderboard is metric x scope (all friends, or one
   group) x time window x demographic bracket — all composable filters over
   the same cache, per the plan's `computeLeaderboard(events, filters)`
   design. */

function exerciseNameFor(canonicalId, exercises) {
  const match = exercises.find((ex) => ex.canonicalId === canonicalId);
  return match ? match.name : canonicalId;
}

async function nameMapForLeaderboard() {
  const identity = await getOrCreateIdentity();
  const friends = await dbGetAll("friends");
  const map = new Map();
  map.set(identity.pubkeyB64, displayNameOf(identity));
  friends.forEach((f) => map.set(f.pubkey, `${f.username}#${f.userTag}`));
  return { map, myPubkey: identity.pubkeyB64 };
}

// ============================= demographic slices =============================

const SLICE_LABELS = { everyone: "Everyone", gender: "Same Gender", height: "Same Height", level: "Same Level" };

function profileList(identity, friends) {
  return [
    { pubkey: identity.pubkeyB64, genderSelf: identity.genderSelf, heightCm: identity.heightCm },
    ...friends.map((f) => ({ pubkey: f.pubkey, genderSelf: f.genderSelf, heightCm: f.heightCm })),
  ];
}

function cumulativeDropsAllTime(events, pubkey) {
  return events
    .filter((e) => e.type === "set" && e.authorPubkey === pubkey)
    .reduce((sum, e) => sum + (e.drops || 0), 0);
}

// Returns a Set of pubkeys belonging to the viewer's own slice, `null` for
// no filter ("everyone"), or an empty Set if the viewer hasn't set the
// field a slice needs (gender/height) — meaning they don't qualify for it.
function resolvePubkeysForSlice(slice, events, identity, people) {
  if (slice === "everyone") return null;
  if (slice === "gender") {
    if (!identity.genderSelf) return new Set();
    return new Set(people.filter((p) => p.genderSelf === identity.genderSelf).map((p) => p.pubkey));
  }
  if (slice === "height") {
    const myBracket = heightBracketFor(identity.heightCm);
    if (!myBracket) return new Set();
    return new Set(people.filter((p) => heightBracketFor(p.heightCm) === myBracket).map((p) => p.pubkey));
  }
  if (slice === "level") {
    const myLevel = levelBracketFor(cumulativeDropsAllTime(events, identity.pubkeyB64));
    return new Set(people.filter((p) => levelBracketFor(cumulativeDropsAllTime(events, p.pubkey)) === myLevel).map((p) => p.pubkey));
  }
  return null;
}

// null means "no filter" throughout this file — intersecting two nullable
// sets keeps that convention instead of treating null as empty.
function intersectPubkeySets(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Set([...a].filter((pk) => b.has(pk)));
}

// ============================= ranked list rendering =============================

function renderRankedList(containerEl, rows, myPubkey, nameMap, formatValue, flaggedPubkeys) {
  containerEl.innerHTML = "";
  const withDrops = rows.filter((r) => r.value > 0);
  if (!withDrops.length) {
    containerEl.innerHTML = `<li class="empty-state">Nothing logged yet.</li>`;
    return;
  }
  const sorted = [...withDrops].sort((a, b) => b.value - a.value);
  sorted.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "entry-item" + (row.pubkey === myPubkey ? " lb-row-me" : "");
    const name = nameMap.get(row.pubkey) || "Unknown";
    const flagged = flaggedPubkeys && flaggedPubkeys.has(row.pubkey);
    li.innerHTML = `
      <div class="entry-main">
        <span class="entry-title lb-rank">#${i + 1}</span>
        <span class="entry-sub">${flagged ? "🚩 " : ""}${escapeHtml(name)}${row.pubkey === myPubkey ? " (you)" : ""}</span>
      </div>
      <span class="card-value">${formatValue(row.value)}</span>`;
    containerEl.appendChild(li);
  });
}

let currentLbMetric = "total"; // total | consistency | exercise
let currentLbExercise = null;
let currentLbWindow = "all"; // all | month | cycle
let currentLbSlice = "everyone"; // everyone | gender | height | level
let currentLbScope = ""; // "" = all friends, else a groupId

async function renderLeaderboardsTab() {
  const [events, exercises, friends, groups] = await Promise.all([
    dbGetAll("leaderboardEvents"), dbGetAll("exercises"), dbGetAll("friends"), dbGetAll("groups"),
  ]);
  const identity = await getOrCreateIdentity();
  const myPubkey = identity.pubkeyB64;
  const nameMap = new Map([[myPubkey, displayNameOf(identity)], ...friends.map((f) => [f.pubkey, `${f.username}#${f.userTag}`])]);

  const picker = document.getElementById("lb-exercise-picker");
  const myExerciseIds = listLoggedExercises(events, myPubkey);
  const previousValue = picker.value;
  picker.innerHTML = myExerciseIds
    .map((cid) => `<option value="${escapeHtml(cid)}">${escapeHtml(exerciseNameFor(cid, exercises))}</option>`)
    .join("");
  if (myExerciseIds.length) {
    picker.value = myExerciseIds.includes(previousValue) ? previousValue : myExerciseIds[0];
    currentLbExercise = picker.value;
  } else {
    currentLbExercise = null;
  }
  picker.classList.toggle("hidden", currentLbMetric !== "exercise");

  const scopePicker = document.getElementById("lb-scope-picker");
  const previousScope = scopePicker.value;
  scopePicker.innerHTML = `<option value="">All Friends</option>` + groups
    .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`)
    .join("");
  currentLbScope = groups.some((g) => g.id === previousScope) ? previousScope : "";
  scopePicker.value = currentLbScope;

  const sliceStatus = document.getElementById("lb-slice-status");
  const people = profileList(identity, friends);
  const scopeGroup = groups.find((g) => g.id === currentLbScope);
  const scopePubkeys = scopeGroup ? new Set(scopeGroup.memberPubkeys) : null;
  const slicePubkeys = resolvePubkeysForSlice(currentLbSlice, events, identity, people);
  const pubkeys = intersectPubkeySets(scopePubkeys, slicePubkeys);
  const missingFieldHint = { gender: "gender", height: "height" }[currentLbSlice];
  sliceStatus.textContent = slicePubkeys && slicePubkeys.size === 0 && missingFieldHint
    ? `Set your ${missingFieldHint} in Friends → Edit to use this slice.`
    : "";
  sliceStatus.classList.toggle("hidden", !sliceStatus.textContent);

  const win = windowFor(currentLbWindow, todayStr());
  const flaggedPubkeys = await computeFlaggedPubkeys(currentLbScope || null);
  const filters = { since: win.since, until: win.until, pubkeys, flaggedPubkeys };

  const list = document.getElementById("leaderboard-list");
  if (currentLbMetric === "consistency") {
    renderRankedList(list, computeConsistencyLeaderboard(events, filters), myPubkey, nameMap, (v) => `${v} day${v === 1 ? "" : "s"}`, flaggedPubkeys);
  } else if (currentLbMetric === "exercise") {
    if (!currentLbExercise) list.innerHTML = `<li class="empty-state">Log this exercise first.</li>`;
    else renderRankedList(list, computeExerciseLeaderboard(events, currentLbExercise, filters), myPubkey, nameMap, (v) => `${Math.round(v)} 🩸`, flaggedPubkeys);
  } else {
    renderRankedList(list, computeTotalDropsLeaderboard(events, filters), myPubkey, nameMap, (v) => `${Math.round(v)} 🩸`, flaggedPubkeys);
  }
}

document.querySelectorAll(".seg-btn[data-lb-metric]").forEach((btn) => {
  btn.addEventListener("click", () => {
    SFX.tap();
    currentLbMetric = btn.dataset.lbMetric;
    document.querySelectorAll(".seg-btn[data-lb-metric]").forEach((b) => b.classList.toggle("is-active", b === btn));
    renderLeaderboardsTab();
  });
});
document.querySelectorAll(".seg-btn[data-lb-window]").forEach((btn) => {
  btn.addEventListener("click", () => {
    SFX.tap();
    currentLbWindow = btn.dataset.lbWindow;
    document.querySelectorAll(".seg-btn[data-lb-window]").forEach((b) => b.classList.toggle("is-active", b === btn));
    renderLeaderboardsTab();
  });
});
document.querySelectorAll(".seg-btn[data-lb-slice]").forEach((btn) => {
  btn.addEventListener("click", () => {
    SFX.tap();
    currentLbSlice = btn.dataset.lbSlice;
    document.querySelectorAll(".seg-btn[data-lb-slice]").forEach((b) => b.classList.toggle("is-active", b === btn));
    renderLeaderboardsTab();
  });
});
document.getElementById("lb-exercise-picker").addEventListener("change", (e) => {
  currentLbExercise = e.target.value;
  renderLeaderboardsTab();
});
document.getElementById("lb-scope-picker").addEventListener("change", (e) => {
  currentLbScope = e.target.value;
  renderLeaderboardsTab();
});

// ============================= home-page resume =============================
//
// Ranks the viewer across every metric x window x slice combination they
// qualify for, and surfaces the ones where they place best. Pure client-side
// re-aggregation of already-cached data — no extra sync.

async function computeMyBestPlacements(maxResults = 3) {
  const [events, exercises, friends, groups] = await Promise.all([
    dbGetAll("leaderboardEvents"), dbGetAll("exercises"), dbGetAll("friends"), dbGetAll("groups"),
  ]);
  const identity = await getOrCreateIdentity();
  const myPubkey = identity.pubkeyB64;
  if (!friends.length || !events.some((e) => e.authorPubkey === myPubkey)) return [];

  const people = profileList(identity, friends);
  const scopes = [{ id: "", name: "All Friends", memberPubkeys: null }, ...groups];
  const windowKinds = ["all", "month", "cycle"];
  const sliceNames = ["everyone", "gender", "height", "level"];
  const exerciseIds = listLoggedExercises(events, myPubkey);
  const today = todayStr();

  const results = [];
  const rankIn = (rows, label) => {
    const ranked = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
    const rank = ranked.findIndex((r) => r.pubkey === myPubkey) + 1;
    if (rank > 0 && ranked.length > 1) results.push({ rank, label });
  };

  for (const scope of scopes) {
    const scopePubkeys = scope.memberPubkeys ? new Set(scope.memberPubkeys) : null;
    const flaggedPubkeys = await computeFlaggedPubkeys(scope.id || null);
    for (const windowKind of windowKinds) {
      const win = windowFor(windowKind, today);
      for (const sliceName of sliceNames) {
        const slicePubkeys = resolvePubkeysForSlice(sliceName, events, identity, people);
        if (slicePubkeys && slicePubkeys.size === 0) continue; // don't qualify for this slice
        const pubkeys = intersectPubkeySets(scopePubkeys, slicePubkeys);
        const filters = { since: win.since, until: win.until, pubkeys, flaggedPubkeys };
        const tail = `${scope.name} · ${SLICE_LABELS[sliceName]} · ${win.label}`;

        rankIn(computeTotalDropsLeaderboard(events, filters), `Total Drops · ${tail}`);
        rankIn(computeConsistencyLeaderboard(events, filters), `Consistency · ${tail}`);
        exerciseIds.forEach((cid) => {
          rankIn(computeExerciseLeaderboard(events, cid, filters), `${exerciseNameFor(cid, exercises)} · ${tail}`);
        });
      }
    }
  }

  results.sort((a, b) => a.rank - b.rank);
  return results.slice(0, maxResults);
}

async function renderResumeCard() {
  const list = document.getElementById("resume-list");
  const friendCount = await dbCount("friends");
  if (!friendCount) {
    list.innerHTML = `<li class="empty-state">Pair a friend (Library → Friends) to start competing.</li>`;
    return;
  }
  const placements = await computeMyBestPlacements();
  if (!placements.length) {
    list.innerHTML = `<li class="empty-state">Log a workout to join the leaderboards.</li>`;
    return;
  }
  list.innerHTML = "";
  placements.forEach((p) => {
    const li = document.createElement("li");
    li.className = "entry-item";
    li.innerHTML = `<div class="entry-main">
      <span class="entry-title resume-rank">#${p.rank}</span>
      <span class="entry-sub">${escapeHtml(p.label)}</span>
    </div>`;
    list.appendChild(li);
  });
}
