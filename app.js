/* FitTrack — all data stays on this device (IndexedDB + localStorage).
   The only outbound network calls this app makes are opt-in and to servers
   you configure yourself (Friends tab): a WebSocket relay for end-to-end
   encrypted sync with devices you've paired via QR (sync.js), and — only if
   you submit or watch a Red Flag Court defense video — a small HTTP
   endpoint that hands back presigned S3 upload/view URLs (moderation.js).
   Neither ever sees plaintext content. See .claude/plans/social-
   leaderboards.md. */

// ============================= DB =============================
const DB_NAME = "fittrack-lite";
const DB_VERSION = 7;
const MAX_LOGS_PER_EXERCISE = 10;
const REST_SECONDS = 180;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("exercises")) {
        const s = db.createObjectStore("exercises", { keyPath: "id", autoIncrement: true });
        s.createIndex("category", "category", { unique: false });
      }
      if (!db.objectStoreNames.contains("weightLogs")) {
        const s = db.createObjectStore("weightLogs", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("workoutLogs")) {
        const s = db.createObjectStore("workoutLogs", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date", { unique: false });
        s.createIndex("exerciseId", "exerciseId", { unique: false });
      }
      if (!db.objectStoreNames.contains("plans")) {
        db.createObjectStore("plans", { keyPath: "id", autoIncrement: true });
      }
      // This device's pairing identity (one row, id 1) and the friends it has
      // paired with via QR — see identity.js. Still fully local/offline: no
      // network call happens until the relay sync step ships.
      if (!db.objectStoreNames.contains("identity")) {
        db.createObjectStore("identity", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("friends")) {
        db.createObjectStore("friends", { keyPath: "pubkey" });
      }
      // Outgoing messages waiting for a relay connection — see sync.js.
      // Drained (and each row deleted) as soon as they're handed to the
      // relay; this is a send buffer, not a message history.
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      }
      // Drops events — this device's own and every friend's, merged into one
      // local cache. Leaderboards are computed by filtering/aggregating this
      // store, never by asking anyone else for a number — see drops.js.
      if (!db.objectStoreNames.contains("leaderboardEvents")) {
        const s = db.createObjectStore("leaderboardEvents", { keyPath: "id" });
        s.createIndex("authorPubkey", "authorPubkey", { unique: false });
      }
      // Named subsets of your friend list — see groups.js. Bounded groups
      // never affect each other; snowball groups union their rosters with
      // any other snowball group a member also belongs to.
      if (!db.objectStoreNames.contains("groups")) {
        db.createObjectStore("groups", { keyPath: "id" });
      }
      // Red Flag Court — see moderation.js. Flag state is never declared by
      // a central authority, it's derived locally from these caches, same
      // pattern as leaderboardEvents.
      if (!db.objectStoreNames.contains("reports")) {
        db.createObjectStore("reports", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("courtVideos")) {
        db.createObjectStore("courtVideos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("courtVotes")) {
        db.createObjectStore("courtVotes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("flagHistory")) {
        db.createObjectStore("flagHistory", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}
function tx(store, mode = "readonly") { return openDB().then((db) => db.transaction(store, mode).objectStore(store)); }
function reqToPromise(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
async function dbAdd(s, v) { return reqToPromise((await tx(s, "readwrite")).add(v)); }
async function dbPut(s, v) { return reqToPromise((await tx(s, "readwrite")).put(v)); }
async function dbDelete(s, k) { return reqToPromise((await tx(s, "readwrite")).delete(k)); }
async function dbClear(s) { return reqToPromise((await tx(s, "readwrite")).clear()); }
async function dbGet(s, k) { return reqToPromise((await tx(s, "readonly")).get(k)); }
async function dbGetAll(s) { return reqToPromise((await tx(s, "readonly")).getAll()); }
async function dbCount(s) { return reqToPromise((await tx(s, "readonly")).count()); }

async function enforceLogRetention(exerciseId) {
  const all = await dbGetAll("workoutLogs");
  const mine = all
    .filter((l) => l.exerciseId === exerciseId)
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
  if (mine.length <= MAX_LOGS_PER_EXERCISE) return;
  for (const log of mine.slice(0, mine.length - MAX_LOGS_PER_EXERCISE)) await dbDelete("workoutLogs", log.id);
}

// Stable, cross-device exercise identity. IndexedDB's autoincrement `id` is
// only a local foreign key (exercises are freely user-editable per device),
// so anything meant to be compared between two people's devices — like a
// leaderboard — has to reference this slug instead.
function slugify(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const DEFAULT_ROM_METERS = 0.4;

// Seeds on first run; also backfills fields added after initial release
// (modality, canonicalId, romMeters) for databases created before they existed.
async function seedExercisesIfEmpty() {
  if ((await dbCount("exercises")) === 0) {
    const store = await tx("exercises", "readwrite");
    for (const ex of SEED_EXERCISES) store.add({ ...ex, custom: false, canonicalId: slugify(ex.name) });
    return;
  }
  const seedByName = new Map(SEED_EXERCISES.map((ex) => [ex.name, ex]));
  const all = await dbGetAll("exercises");
  for (const e of all) {
    let changed = false;
    if (!e.modality) { e.modality = e.category === "Cardio" ? "cardio" : "strength"; changed = true; }
    if (!e.canonicalId) { e.canonicalId = slugify(e.name); changed = true; }
    if (e.romMeters === undefined) {
      const seed = seedByName.get(e.name);
      e.romMeters = seed ? seed.romMeters : (e.modality === "cardio" ? null : DEFAULT_ROM_METERS);
      changed = true;
    }
    if (changed) await dbPut("exercises", e);
  }
}

// ============================= utils =============================
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayStr = () => toDateStr(new Date());
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysStr(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + delta));
}
function formatNiceDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str ?? ""; return d.innerHTML; }
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden"); el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.classList.add("hidden"), 200); }, 1600);
}
function vibrate(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch {} } }

// mm:ss helpers for cardio durations
function secsToClock(secs) {
  secs = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
               : `${m}:${String(s).padStart(2, "0")}`;
}
function clockToSecs(str) {
  if (!str) return 0;
  const parts = String(str).trim().split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;  // bare number = minutes typed loosely? treat as seconds
}

const isCardio = (ex) => (ex?.modality || "strength") === "cardio";

// One place that decides how a set reads back, so history, calendar and
// copy buttons never disagree about formatting.
function formatSet(s) {
  if (s.duration != null || s.distance != null) {
    const bits = [];
    if (s.duration) bits.push(secsToClock(s.duration));
    if (s.distance) bits.push(`${s.distance}km`);
    return bits.join(" · ") || "—";
  }
  if (s.bw) return s.weight > 0 ? `${s.reps}×BW+${s.weight}` : `${s.reps}×BW`;
  return `${s.reps}×${s.weight}kg`;
}

const LS = {
  unlocked: "ft_unlocked_achievements",
  prs: "ft_prs",
  lastPlan: "ft_last_plan_id",
  restsSkipped: "ft_rests_skipped",
  restsCompleted: "ft_rests_completed",
  loggedLate: "ft_logged_late",
  loggedEarly: "ft_logged_early",
  perfectSplits: "ft_perfect_splits",
  onboarded: "ft_onboarded", // shared literal with onboarding.js's ONBOARDING_LS_KEY
};
function lsGet(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function lsSet(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
function lsBump(key) { const v = lsGet(key, 0) + 1; lsSet(key, v); return v; }

// ============================= modals =============================
let modalZ = 100;
function openModal(id) { const el = document.getElementById(id); modalZ += 1; el.style.zIndex = modalZ; el.classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
document.querySelectorAll(".modal-overlay").forEach((o) =>
  o.addEventListener("click", (e) => { if (e.target === o) o.classList.add("hidden"); })
);

// ============================= navigation =============================
// No footer: Home is the root, the header trophy jumps to achievements and the
// grid icon opens the Library hub. Sub-pages show a back arrow in the header.
const SUB_PAGES = ["tab-plans", "tab-exercises", "tab-weight", "tab-achievements", "tab-friends", "tab-groups", "tab-leaderboards"];
let navStack = [];

function switchTab(tabId, push = true) {
  const current = document.querySelector(".tab-panel.active")?.id;
  if (push && current && current !== tabId) navStack.push(current);
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");

  const backBtn = document.getElementById("hdr-back");
  backBtn.classList.toggle("hidden", tabId === "tab-home");
  document.getElementById("hdr-trophy").classList.toggle("is-active", tabId === "tab-achievements");
  document.getElementById("hdr-library").classList.toggle("is-active", tabId === "tab-library");
  window.scrollTo(0, 0);

  if (tabId === "tab-home") renderHome();
  if (tabId === "tab-library") renderLibrary();
  if (tabId === "tab-weight") renderWeightTab();
  if (tabId === "tab-exercises") renderExercisesTab();
  if (tabId === "tab-plans") renderPlansTab();
  if (tabId === "tab-achievements") renderAchievementsTab();
  if (tabId === "tab-friends") renderFriendsTab();
  if (tabId === "tab-groups") renderGroupsTab();
  if (tabId === "tab-leaderboards") renderLeaderboardsTab();
}
function goBack() {
  const prev = navStack.pop() || "tab-home";
  switchTab(prev, false);
}
function refreshCurrentTab() { switchTab(document.querySelector(".tab-panel.active").id, false); }

document.getElementById("hdr-back").addEventListener("click", () => { SFX.swipe(); goBack(); });
document.getElementById("hdr-trophy").addEventListener("click", () => { SFX.swipe(); switchTab("tab-achievements"); });
document.getElementById("hdr-library").addEventListener("click", () => { SFX.swipe(); switchTab("tab-library"); });
document.getElementById("hud-ach-btn").addEventListener("click", () => { SFX.swipe(); switchTab("tab-achievements"); });
document.querySelectorAll(".menu-item").forEach((i) => i.addEventListener("click", () => { SFX.swipe(); switchTab(i.dataset.goto); }));
document.getElementById("trend-card").addEventListener("click", () => { SFX.swipe(); switchTab("tab-weight"); });

// sound toggle
const soundBtn = document.getElementById("hdr-sound");
soundBtn.classList.toggle("muted", sfxMuted());
soundBtn.addEventListener("click", () => {
  sfxSetMuted(!sfxMuted());
  soundBtn.classList.toggle("muted", sfxMuted());
  if (!sfxMuted()) SFX.log();
  showToast(sfxMuted() ? "Sound off" : "Sound on");
});

// ============================= stats =============================
async function computeStats() {
  const [weightLogs, workoutLogs, plans, exercises] = await Promise.all([
    dbGetAll("weightLogs"), dbGetAll("workoutLogs"), dbGetAll("plans"), dbGetAll("exercises"),
  ]);

  const exById = new Map(exercises.map((e) => [e.id, e]));
  const activityDates = new Set([...weightLogs.map((w) => w.date), ...workoutLogs.map((w) => w.date)]);
  const sortedDates = [...activityDates].sort();

  // bodyweight sets count toward volume using the closest known bodyweight
  const sortedWeights = [...weightLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latestBW = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : 70;

  let currentStreak = 0;
  if (sortedDates.length) {
    const last = sortedDates[sortedDates.length - 1];
    if ((new Date(todayStr()) - new Date(last)) / 86400000 <= 1) {
      let c = last; while (activityDates.has(c)) { currentStreak++; c = addDaysStr(c, -1); }
    }
  }
  let bestStreak = 0, run = 0, hasComeback = false;
  sortedDates.forEach((d, i) => {
    if (i === 0) run = 1;
    else {
      const gap = (new Date(d) - new Date(sortedDates[i - 1])) / 86400000;
      if (gap === 1) run++; else { if (gap >= 8) hasComeback = true; run = 1; }
    }
    bestStreak = Math.max(bestStreak, run);
  });

  const setsPerDay = {}, volPerDay = {}, splitsPerDay = {}, setsByCategory = {};
  let totalSetsLogged = 0, totalReps = 0, totalVolume = 0, maxRepsInSet = 0, heaviestLift = 0;
  let totalCardioSecs = 0, totalDistance = 0;

  workoutLogs.forEach((w) => {
    setsPerDay[w.date] = (setsPerDay[w.date] || 0) + w.sets.length;
    const cat = exById.get(w.exerciseId)?.category;
    if (cat) setsByCategory[cat] = (setsByCategory[cat] || 0) + w.sets.length;
    w.sets.forEach((s) => {
      totalSetsLogged++;
      if (s.duration != null || s.distance != null) {
        totalCardioSecs += s.duration || 0;
        totalDistance += s.distance || 0;
        return;
      }
      totalReps += s.reps || 0;
      const effWeight = s.bw ? latestBW + (s.weight || 0) : (s.weight || 0);
      const vol = (s.reps || 0) * effWeight;
      totalVolume += vol;
      volPerDay[w.date] = (volPerDay[w.date] || 0) + vol;
      maxRepsInSet = Math.max(maxRepsInSet, s.reps || 0);
      heaviestLift = Math.max(heaviestLift, effWeight);
    });
  });

  const sessionsByDay = {};
  workoutLogs.filter((w) => w.sessionId).forEach((w) => {
    (sessionsByDay[w.date] = sessionsByDay[w.date] || new Set()).add(w.sessionId);
  });
  Object.entries(sessionsByDay).forEach(([d, set]) => { splitsPerDay[d] = set.size; });

  const weightDates = [...new Set(weightLogs.map((w) => w.date))].sort();
  let weightStreak = 0;
  if (weightDates.length) {
    const last = weightDates[weightDates.length - 1];
    if ((new Date(todayStr()) - new Date(last)) / 86400000 <= 1) {
      let c = last; const s = new Set(weightDates);
      while (s.has(c)) { weightStreak++; c = addDaysStr(c, -1); }
    }
  }
  const weightDelta = sortedWeights.length >= 2
    ? sortedWeights[sortedWeights.length - 1].weight - sortedWeights[0].weight : 0;

  let perfectWeeks = 0;
  if (sortedDates.length >= 7) {
    const seen = new Set();
    sortedDates.forEach((d) => {
      const [y, m, dd] = d.split("-").map(Number);
      const dt = new Date(y, m - 1, dd);
      const weekStart = toDateStr(new Date(y, m - 1, dd - dt.getDay()));
      if (seen.has(weekStart)) return;
      let all = true;
      for (let i = 0; i < 7; i++) if (!activityDates.has(addDaysStr(weekStart, i))) { all = false; break; }
      if (all) { perfectWeeks++; seen.add(weekStart); }
    });
  }
  const weekendDays = [...activityDates].filter((d) => {
    const [y, m, dd] = d.split("-").map(Number);
    const wd = new Date(y, m - 1, dd).getDay();
    return wd === 0 || wd === 6;
  }).length;

  const prMap = lsGet(LS.prs, {});
  const xp = totalSetsLogged * 10 + Object.keys(sessionsByDay).length * 20 + weightLogs.length * 5
    + Object.values(splitsPerDay).reduce((a, b) => a + b, 0) * 40;
  const level = Math.floor(xp / 150) + 1;

  return {
    activityDates, activeDayCount: activityDates.size,
    currentStreak, bestStreak, hasComeback, perfectWeeks, weekendDays,
    totalSetsLogged, totalReps, totalVolume, maxRepsInSet, heaviestLift,
    totalCardioSecs, totalDistance, latestBW,
    maxSetsInADay: Math.max(0, ...Object.values(setsPerDay)),
    maxVolumeInADay: Math.max(0, ...Object.values(volPerDay)),
    maxSplitsInADay: Math.max(0, ...Object.values(splitsPerDay)),
    totalSplitsCompleted: new Set(workoutLogs.filter((w) => w.sessionId).map((w) => w.sessionId)).size,
    totalWeightLogs: weightLogs.length, weightStreak, weightDelta,
    totalPlans: plans.length,
    maxSplitsInPlan: Math.max(0, ...plans.map((p) => p.splits.length)),
    maxExercisesInSplit: Math.max(0, ...plans.flatMap((p) => p.splits.map((s) => s.exercises.length))),
    uniqueExercises: new Set(workoutLogs.map((w) => w.exerciseId)).size,
    uniqueCategories: new Set(Object.keys(setsByCategory)).size,
    setsByCategory,
    customExercises: exercises.filter((e) => e.custom).length,
    prCount: Object.keys(prMap).length,
    perfectSplits: lsGet(LS.perfectSplits, 0),
    restsSkipped: lsGet(LS.restsSkipped, 0),
    restsCompleted: lsGet(LS.restsCompleted, 0),
    loggedLate: lsGet(LS.loggedLate, false),
    loggedEarly: lsGet(LS.loggedEarly, false),
    unlockedCount: lsGet(LS.unlocked, []).length,
    onboarded: lsGet(LS.onboarded, false),
    xp, level, xpPercent: Math.round(((xp % 150) / 150) * 100),
    plans, workoutLogs, weightLogs, exercises,
  };
}

function recordPRIfNew(exerciseId, weight) {
  if (!weight || weight <= 0) return false;
  const prs = lsGet(LS.prs, {});
  if (weight > (prs[exerciseId] || 0)) { prs[exerciseId] = weight; lsSet(LS.prs, prs); return true; }
  return false;
}

// ============================= achievements =============================
let achQueue = [];
async function checkAchievements() {
  const stats = await computeStats();
  const unlocked = new Set(lsGet(LS.unlocked, []));
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    let ok = false;
    try { ok = a.check(stats); } catch { ok = false; }
    if (ok) { unlocked.add(a.id); achQueue.push(a); changed = true; }
  }
  if (changed) lsSet(LS.unlocked, [...unlocked]);
  drainAchievements();
}
function drainAchievements() {
  if (!achQueue.length) return;
  if (!document.getElementById("modal-achievement").classList.contains("hidden")) return;
  const a = achQueue.shift();
  document.getElementById("achievement-icon").textContent = a.icon;
  document.getElementById("achievement-name").textContent = a.name;
  document.getElementById("achievement-desc").textContent = a.desc;
  openModal("modal-achievement");
  SFX.achievement();
  vibrate([30, 60, 30]);
}
document.querySelectorAll('[data-close="modal-achievement"]').forEach((b) =>
  b.addEventListener("click", () => setTimeout(drainAchievements, 260))
);

async function renderAchievementsTab() {
  const stats = await computeStats();
  const unlocked = new Set(lsGet(LS.unlocked, []));
  const container = document.getElementById("achievements-list");
  container.innerHTML = "";
  document.getElementById("ach-progress-text").textContent = `${unlocked.size} / ${ACHIEVEMENTS.length} unlocked`;
  document.getElementById("ach-progress-fill").style.width = `${Math.round((unlocked.size / ACHIEVEMENTS.length) * 100)}%`;

  [...new Set(ACHIEVEMENTS.map((a) => a.cat))].forEach((cat) => {
    const inCat = ACHIEVEMENTS.filter((a) => a.cat === cat);
    const h = document.createElement("div");
    h.className = "ach-cat-heading";
    h.textContent = `${cat} — ${inCat.filter((a) => unlocked.has(a.id)).length}/${inCat.length}`;
    container.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "ach-grid";
    inCat.forEach((a) => {
      const got = unlocked.has(a.id);
      const tile = document.createElement("div");
      tile.className = "ach-tile " + (got ? "unlocked" : "locked");
      tile.innerHTML = `
        <span class="ach-tile-icon">${got ? a.icon : "🔒"}</span>
        <div class="ach-tile-name">${escapeHtml(got ? a.name : "???")}</div>
        <div class="ach-tile-desc">${escapeHtml(a.desc)}</div>`;
      grid.appendChild(tile);
    });
    container.appendChild(grid);
  });
}

// ============================= mascot =============================
function sayHome(key, vars) {
  const line = pickLine(key, vars);
  document.getElementById("mascot-line").textContent = line.t;
  setMascotMood(line.m, document.getElementById("tab-home"));
}
function saySession(key, vars) {
  const line = pickLine(key, vars);
  const el = document.getElementById("session-mascot-line");
  if (el) el.textContent = line.t;
  setMascotMood(line.m, document.getElementById("session-screen"));
}
setInterval(() => {
  document.querySelectorAll(".mascot-svg.mood-idle").forEach((svg) => {
    svg.classList.add("blinking");
    setTimeout(() => svg.classList.remove("blinking"), 150);
  });
}, 3600);

// ============================= HOME =============================
document.getElementById("btn-log-weight").addEventListener("click", () => openWeightModal());
document.getElementById("btn-log-weight-2").addEventListener("click", () => openWeightModal());
document.getElementById("hero-no-plan-btn").addEventListener("click", () => { switchTab("tab-plans"); openPlanEditor(null); });
document.getElementById("hero-switch-plan").addEventListener("click", openPlanPicker);

async function renderHome() {
  const today = todayStr();
  document.getElementById("topbar-date").textContent = formatNiceDate(today);
  const stats = await computeStats();

  document.getElementById("hud-streak").textContent = stats.currentStreak;
  document.getElementById("hud-level").textContent = `Lv.${stats.level}`;
  document.getElementById("hud-ach-count").textContent = stats.unlockedCount;
  document.getElementById("xp-bar-fill").style.width = `${stats.xpPercent}%`;

  const doneToday = stats.activityDates.has(today);
  if (stats.totalPlans === 0) sayHome("noPlan");
  else if (doneToday) sayHome("doneToday");
  else if (stats.currentStreak === 0 && stats.activeDayCount > 0) sayHome("streakBroken");
  else if (stats.currentStreak >= 3) sayHome("streakAlive");
  else sayHome("readyToday");

  const heroLabel = document.getElementById("hero-plan-name");
  const heroSplits = document.getElementById("hero-splits");
  const noPlanBtn = document.getElementById("hero-no-plan-btn");
  const switchBtn = document.getElementById("hero-switch-plan");
  heroSplits.innerHTML = "";

  if (!stats.plans.length) {
    heroLabel.textContent = "No plan yet";
    noPlanBtn.style.display = "block";
    switchBtn.style.display = "none";
  } else {
    noPlanBtn.style.display = "none";
    switchBtn.style.display = stats.plans.length > 1 ? "flex" : "none";
    const lastId = lsGet(LS.lastPlan, null);
    const plan = stats.plans.find((p) => p.id === lastId) || stats.plans[0];
    heroLabel.textContent = plan.name;
    plan.splits.forEach((split) => {
      const totalSets = split.exercises.reduce((n, e) => n + (e.targetSets || 0), 0);
      const btn = document.createElement("button");
      btn.className = "hero-split-btn";
      btn.innerHTML = `<span>${escapeHtml(split.name)}<span class="hs-meta">${split.exercises.length} exercises · ${totalSets} sets</span></span><span class="hs-play">▶</span>`;
      btn.addEventListener("click", () => { lsSet(LS.lastPlan, plan.id); startSession(plan, split); });
      heroSplits.appendChild(btn);
    });
  }

  renderTrendCard(stats.weightLogs);
  renderCalendar();
  renderResumeCard();
}

function openPlanPicker() {
  dbGetAll("plans").then((plans) => {
    const body = document.getElementById("plan-picker-body");
    body.innerHTML = "";
    plans.forEach((p) => {
      const row = document.createElement("div");
      row.className = "entry-item entry-item-clickable";
      row.innerHTML = `<div class="entry-main"><span class="entry-title">${escapeHtml(p.name)}</span><span class="entry-sub">${p.splits.length} splits</span></div><span class="entry-chevron">›</span>`;
      row.addEventListener("click", () => { lsSet(LS.lastPlan, p.id); closeModal("modal-plan-picker"); renderHome(); });
      body.appendChild(row);
    });
    openModal("modal-plan-picker");
  });
}

// weight sparkline on Home
function renderTrendCard(weightLogs) {
  const card = document.getElementById("trend-card");
  const logs = [...weightLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!logs.length) { card.classList.add("is-empty"); return; }
  card.classList.remove("is-empty");

  const latest = logs[logs.length - 1];
  document.getElementById("trend-current").textContent = `${latest.weight} kg`;
  const deltaEl = document.getElementById("trend-delta");
  if (logs.length >= 2) {
    const d = latest.weight - logs[0].weight;
    deltaEl.textContent = `${d >= 0 ? "+" : ""}${d.toFixed(1)} kg since ${formatNiceDate(logs[0].date)}`;
    deltaEl.className = "trend-delta " + (d > 0 ? "up" : d < 0 ? "down" : "");
  } else {
    deltaEl.textContent = "First weigh-in logged";
    deltaEl.className = "trend-delta";
  }

  const canvas = document.getElementById("trend-spark");
  const pts = logs.slice(-20);
  const dpr = window.devicePixelRatio || 1;
  const w0 = Math.max(60, canvas.clientWidth || 160), h0 = 52;
  canvas.width = w0 * dpr; canvas.height = h0 * dpr;
  canvas.style.height = h0 + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w0, h0);
  if (pts.length < 2) return;

  const ws = pts.map((p) => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const pad = (max - min) * 0.2 || 1;
  const yMin = min - pad, yMax = max + pad;
  const px = (i) => 2 + (i / (pts.length - 1)) * (w0 - 4);
  const py = (v) => 6 + (h0 - 12) - ((v - yMin) / (yMax - yMin)) * (h0 - 12);

  const grad = ctx.createLinearGradient(0, 0, 0, h0);
  grad.addColorStop(0, "rgba(255,45,77,.35)");
  grad.addColorStop(1, "rgba(255,45,77,0)");
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.weight)) : ctx.moveTo(px(i), py(p.weight))));
  ctx.lineTo(px(pts.length - 1), h0); ctx.lineTo(px(0), h0); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.weight)) : ctx.moveTo(px(i), py(p.weight))));
  ctx.strokeStyle = "#ff2d4d"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#ff2d4d";
  ctx.beginPath(); ctx.arc(px(pts.length - 1), py(pts[pts.length - 1].weight), 3, 0, Math.PI * 2); ctx.fill();
}

function openWeightModal(prefill) {
  document.getElementById("weight-date").value = prefill || todayStr();
  document.getElementById("weight-value").value = "";
  openModal("modal-weight");
}
document.getElementById("save-weight").addEventListener("click", async () => {
  const date = document.getElementById("weight-date").value || todayStr();
  const weight = parseFloat(document.getElementById("weight-value").value);
  if (!weight || weight <= 0) { SFX.error(); return showToast("Enter a valid weight"); }
  await dbAdd("weightLogs", { date, weight });
  closeModal("modal-weight");
  SFX.weight();
  showToast("Weight logged");
  await checkAchievements();
  refreshCurrentTab();
});

async function renderLibrary() {
  const s = await computeStats();
  document.getElementById("lib-plans-meta").textContent = `${s.totalPlans} plan${s.totalPlans === 1 ? "" : "s"}`;
  document.getElementById("lib-ex-meta").textContent = `${s.exercises.length} exercises`;
  document.getElementById("lib-weight-meta").textContent = s.totalWeightLogs ? `${s.totalWeightLogs} weigh-ins` : "No data yet";
  document.getElementById("lib-ach-meta").textContent = `${s.unlockedCount} / ${ACHIEVEMENTS.length} unlocked`;
  const friendCount = await dbCount("friends");
  document.getElementById("lib-friends-meta").textContent = friendCount ? `${friendCount} paired` : "No friends yet";
  const eventCount = await dbCount("leaderboardEvents");
  document.getElementById("lib-lb-meta").textContent = eventCount ? "Ranked" : "Log a workout to join";
  const groupCount = await dbCount("groups");
  document.getElementById("lib-groups-meta").textContent = groupCount ? `${groupCount} joined` : "No groups yet";
}

// =========================================================
// SESSION PLAYER
// =========================================================
let session = null;

async function startSession(plan, split) {
  if (!split.exercises?.length) return showToast("This split has no exercises yet");
  const exercises = await dbGetAll("exercises");
  const exById = new Map(exercises.map((e) => [e.id, e]));

  const steps = [];
  split.exercises.forEach((ex, exIdx) => {
    const full = exById.get(ex.exerciseId);
    const cardio = isCardio(full);
    const n = Math.max(1, ex.targetSets || (cardio ? 1 : 3));
    for (let i = 0; i < n; i++) {
      steps.push({
        exIdx, exerciseId: ex.exerciseId, exerciseName: ex.exerciseName,
        cardio, setNum: i + 1, setTotal: n, targetReps: ex.targetReps,
        logged: false, reps: null, weight: null, bw: false, duration: null, distance: null,
      });
    }
  });

  session = { plan, split, sessionId: genId(), steps, i: 0, skips: 0, historyCache: {} };
  document.getElementById("session-screen").classList.remove("hidden");
  document.getElementById("session-plan-crumb").textContent = `${plan.name} · ${split.name}`;
  mountMascots();
  await renderStep("in-left");
  const s0 = steps[0];
  saySession("setStart", { set: 1, total: s0.setTotal, exercise: s0.exerciseName });
}

function endSession(completed) {
  const wasPerfect = session && session.skips === 0 && session.steps.every((s) => s.logged);
  if (completed && wasPerfect) lsBump(LS.perfectSplits);
  session = null;
  stopwatchReset();
  hideRest();
  document.getElementById("session-screen").classList.add("hidden");
  refreshCurrentTab();
}
document.getElementById("session-quit").addEventListener("click", () => {
  saySession("sessionQuit"); endSession(false); showToast("Session ended");
});

async function renderStep(animDir) {
  if (!session) return;
  const step = session.steps[session.i];
  const card = document.querySelector(".session-card");
  if (animDir) {
    card.classList.remove("swipe-in-left", "swipe-in-right");
    void card.offsetWidth;
    card.classList.add(animDir === "in-left" ? "swipe-in-left" : "swipe-in-right");
  }

  document.getElementById("session-ex-crumb").textContent =
    `Exercise ${step.exIdx + 1} of ${session.split.exercises.length}`;
  document.getElementById("session-exercise-name").textContent = step.exerciseName;
  document.getElementById("set-number").textContent = step.setNum;
  document.getElementById("set-total").textContent = step.setTotal;
  document.getElementById("session-target-line").textContent =
    step.targetReps ? (step.cardio ? `Target ${step.targetReps}` : `Target ${step.targetReps} reps`) : "";

  document.getElementById("strength-inputs").classList.toggle("hidden", step.cardio);
  document.getElementById("cardio-inputs").classList.toggle("hidden", !step.cardio);

  const hist = await getExerciseHistory(step.exerciseId);
  const prevSame = session.steps.slice(0, session.i).filter((s) => s.exerciseId === step.exerciseId && s.logged).pop();
  const lastSet = hist[0]?.sets?.[Math.min(step.setNum - 1, (hist[0]?.sets?.length || 1) - 1)];

  if (step.cardio) {
    stopwatchReset();
    const dur = step.duration ?? prevSame?.duration ?? lastSet?.duration ?? "";
    document.getElementById("input-duration").value = dur ? secsToClock(dur) : "";
    document.getElementById("input-distance").value = step.distance ?? prevSame?.distance ?? lastSet?.distance ?? "";
  } else {
    document.getElementById("input-reps").value = step.reps ?? prevSame?.reps ?? lastSet?.reps ?? "";
    document.getElementById("input-weight").value = step.weight ?? prevSame?.weight ?? lastSet?.weight ?? "";
    setBW(step.bw ?? prevSame?.bw ?? lastSet?.bw ?? false);
  }

  document.getElementById("btn-log-set").textContent = step.logged ? "UPDATE SET" : "LOG SET";
  renderDots();
  renderSessionHistory(hist, step);
}

function renderDots() {
  const wrap = document.getElementById("session-progress-dots");
  wrap.innerHTML = "";
  session.steps.forEach((s, idx) => {
    const d = document.createElement("i");
    d.className = "sdot" + (s.logged ? " done" : "") + (idx === session.i ? " current" : "");
    wrap.appendChild(d);
  });
}

async function getExerciseHistory(exerciseId) {
  if (session?.historyCache[exerciseId]) return session.historyCache[exerciseId];
  const all = await dbGetAll("workoutLogs");
  const logs = all
    .filter((l) => l.exerciseId === exerciseId && l.sessionId !== session?.sessionId)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
    .slice(0, MAX_LOGS_PER_EXERCISE);
  if (session) session.historyCache[exerciseId] = logs;
  return logs;
}

const COPY_ICON = `<svg class="ic" viewBox="0 0 24 24"><path d="M9 9h10v10H9zM5 15V5h10"/></svg>`;

function renderSessionHistory(logs, step) {
  const list = document.getElementById("session-history");
  const prs = lsGet(LS.prs, {});
  document.getElementById("history-pr").textContent =
    !step.cardio && prs[step.exerciseId] ? `PR ${prs[step.exerciseId]}kg` : "";
  list.innerHTML = "";
  if (!logs.length) {
    list.innerHTML = `<li class="empty-state">No history yet — this is where it begins.</li>`;
    return;
  }
  logs.forEach((w) => {
    // one row per past session; the copy button pulls the set that lines up
    // with the set number you're currently on (falling back to the last one)
    const src = w.sets[Math.min(step.setNum - 1, w.sets.length - 1)];
    const li = document.createElement("li");
    li.className = "history-row";
    li.innerHTML = `
      <div class="history-main">
        <span class="history-date">${formatNiceDate(w.date)}</span>
        <span class="history-sets">${escapeHtml(w.sets.map(formatSet).join("  "))}</span>
      </div>
      <button class="copy-btn" title="Copy into inputs">${COPY_ICON}</button>`;
    li.querySelector(".copy-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      SFX.copy();
      copySetIntoInputs(src, step);
      const btn = e.currentTarget;
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 600);
    });
    list.appendChild(li);
  });
}

function copySetIntoInputs(src, step) {
  if (!src) return showToast("Nothing to copy");
  if (step.cardio) {
    document.getElementById("input-duration").value = src.duration ? secsToClock(src.duration) : "";
    document.getElementById("input-distance").value = src.distance ?? "";
  } else {
    document.getElementById("input-reps").value = src.reps ?? "";
    document.getElementById("input-weight").value = src.weight ?? "";
    setBW(!!src.bw);
  }
  vibrate(12);
  showToast(`Copied ${formatSet(src)}`);
}

// ---------- bodyweight toggle ----------
function setBW(on) {
  const t = document.getElementById("bw-toggle");
  t.classList.toggle("on", !!on);
  document.getElementById("weight-label").textContent = on ? "+KG" : "KG";
}
document.getElementById("bw-toggle").addEventListener("click", () => {
  setBW(!document.getElementById("bw-toggle").classList.contains("on"));
  vibrate(8);
});

// ---------- steppers ----------
document.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.dataset.step;
    const delta = parseFloat(btn.dataset.delta);
    if (kind === "dur") {
      const el = document.getElementById("input-duration");
      el.value = secsToClock(Math.max(0, clockToSecs(el.value) + delta));
    } else if (kind === "dist") {
      const el = document.getElementById("input-distance");
      el.value = Math.max(0, Math.round(((parseFloat(el.value) || 0) + delta) * 10) / 10);
    } else {
      const el = document.getElementById(kind === "reps" ? "input-reps" : "input-weight");
      const next = Math.max(0, (parseFloat(el.value) || 0) + delta);
      el.value = kind === "reps" ? Math.round(next) : Math.round(next * 2) / 2;
    }
    SFX.tap();
    vibrate(8);
  });
});

// ---------- stopwatch ----------
let sw = { running: false, elapsed: 0, startedAt: 0, timer: null };
function stopwatchReset() {
  if (sw.timer) clearInterval(sw.timer);
  sw = { running: false, elapsed: 0, startedAt: 0, timer: null };
  const d = document.getElementById("sw-display");
  if (d) { d.textContent = "0:00"; d.classList.remove("running"); }
  const t = document.getElementById("sw-toggle");
  if (t) t.textContent = "Start";
  const p = document.getElementById("sw-pace");
  if (p) p.textContent = "";
}
function swTick() {
  sw.elapsed = Math.floor((Date.now() - sw.startedAt) / 1000);
  document.getElementById("sw-display").textContent = secsToClock(sw.elapsed);
  const dist = parseFloat(document.getElementById("input-distance").value) || 0;
  const pace = document.getElementById("sw-pace");
  pace.textContent = dist > 0 && sw.elapsed > 0
    ? `Pace ${secsToClock(sw.elapsed / dist)} /km` : "";
}
document.getElementById("sw-toggle").addEventListener("click", () => {
  const display = document.getElementById("sw-display");
  if (sw.running) {
    clearInterval(sw.timer); sw.running = false;
    display.classList.remove("running");
    document.getElementById("sw-toggle").textContent = "Resume";
    SFX.swStop();
  } else {
    sw.startedAt = Date.now() - sw.elapsed * 1000;
    sw.running = true;
    display.classList.add("running");
    document.getElementById("sw-toggle").textContent = "Pause";
    sw.timer = setInterval(swTick, 250);
    SFX.swStart();
  }
  vibrate(10);
});
document.getElementById("sw-reset").addEventListener("click", stopwatchReset);
document.getElementById("sw-use").addEventListener("click", () => {
  if (!sw.elapsed) return showToast("Stopwatch hasn't run yet");
  document.getElementById("input-duration").value = secsToClock(sw.elapsed);
  showToast("Time copied");
  vibrate(12);
});

// ---------- logging a set ----------
document.getElementById("btn-log-set").addEventListener("click", () => logCurrentSet());

async function logCurrentSet() {
  if (!session) return;
  const step = session.steps[session.i];
  let isPR = false;

  if (step.cardio) {
    const duration = clockToSecs(document.getElementById("input-duration").value);
    const distance = parseFloat(document.getElementById("input-distance").value) || 0;
    if (duration <= 0 && distance <= 0) return showToast("Enter time or distance");
    step.duration = duration; step.distance = distance; step.logged = true;
    if (sw.running) { clearInterval(sw.timer); sw.running = false; }
  } else {
    const reps = parseInt(document.getElementById("input-reps").value, 10) || 0;
    const weight = parseFloat(document.getElementById("input-weight").value) || 0;
    const bw = document.getElementById("bw-toggle").classList.contains("on");
    if (reps <= 0 && weight <= 0 && !bw) return showToast("Enter reps or weight");
    step.reps = reps; step.weight = weight; step.bw = bw; step.logged = true;
    const stats = await computeStats();
    isPR = recordPRIfNew(step.exerciseId, bw ? stats.latestBW + weight : weight);
  }

  await persistSessionExercise(step.exerciseId, step.exerciseName);

  const hour = new Date().getHours();
  if (hour >= 22) lsSet(LS.loggedLate, true);
  if (hour < 6) lsSet(LS.loggedEarly, true);

  vibrate(20);
  mascotReact("bounce", document.getElementById("session-screen"));
  if (isPR) { SFX.pr(); saySession("newPR"); showToast("New PR! 💪"); }
  else { SFX.log(); saySession("setLogged"); }

  await checkAchievements();
  renderDots();

  if (session.i >= session.steps.length - 1) {
    SFX.victory();
    saySession("splitDone");
    setTimeout(() => { showToast(`${session.split.name} complete 💪`); endSession(true); }, 1200);
    return;
  }
  const nextStep = session.steps[session.i + 1];
  setTimeout(() => startRest(nextStep.exerciseId !== step.exerciseId), 500);
}

// One workoutLogs row per exercise per session, so a 4-set exercise reads
// back as a single history entry.
async function persistSessionExercise(exerciseId, exerciseName) {
  const sets = session.steps
    .filter((s) => s.exerciseId === exerciseId && s.logged)
    .map((s) => (s.cardio
      ? { duration: s.duration, distance: s.distance }
      : { reps: s.reps, weight: s.weight, bw: !!s.bw }));
  if (!sets.length) return;

  const all = await dbGetAll("workoutLogs");
  const existing = all.find((l) => l.sessionId === session.sessionId && l.exerciseId === exerciseId);
  const payload = {
    date: todayStr(), exerciseId, exerciseName, sets,
    sessionId: session.sessionId, planId: session.plan.id,
    planName: session.plan.name, splitName: session.split.name,
  };
  if (existing) { payload.id = existing.id; await dbPut("workoutLogs", payload); }
  else { payload.id = await dbAdd("workoutLogs", payload); await enforceLogRetention(exerciseId); }
  recordLeaderboardEventForLog(payload);
}

function goToStep(idx, dir) {
  if (!session || idx < 0 || idx >= session.steps.length) return;
  const card = document.querySelector(".session-card");
  card.classList.remove("swipe-out-left", "swipe-out-right");
  void card.offsetWidth;
  card.classList.add(dir === "next" ? "swipe-out-left" : "swipe-out-right");
  setTimeout(async () => {
    session.i = idx;
    card.classList.remove("swipe-out-left", "swipe-out-right");
    await renderStep(dir === "next" ? "in-left" : "in-right");
    const s = session.steps[idx];
    if (!s.logged) saySession("setStart", { set: s.setNum, total: s.setTotal, exercise: s.exerciseName });
  }, 200);
}
document.getElementById("btn-prev-set").addEventListener("click", () => goToStep(session.i - 1, "prev"));
document.getElementById("btn-skip-set").addEventListener("click", () => {
  if (!session) return;
  session.skips++;
  SFX.skip();
  saySession("skipped");
  mascotReact("shake", document.getElementById("session-screen"));
  if (session.i >= session.steps.length - 1) { showToast("Split ended"); endSession(false); }
  else goToStep(session.i + 1, "next");
});

// swipe between sets
(function attachSwipe() {
  const area = document.getElementById("session-swipe");
  let x0 = null, y0 = null, t0 = 0;
  area.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });
  area.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 800) return;
    goToStep(session.i + (dx < 0 ? 1 : -1), dx < 0 ? "next" : "prev");
  }, { passive: true });
})();

// split overview
document.getElementById("session-overview-btn").addEventListener("click", () => {
  if (!session) return;
  document.getElementById("overview-title").textContent = `${session.split.name} — overview`;
  const body = document.getElementById("overview-body");
  body.innerHTML = "";
  const cur = session.steps[session.i];
  session.split.exercises.forEach((ex, idx) => {
    const steps = session.steps.filter((s) => s.exIdx === idx);
    const done = steps.filter((s) => s.logged).length;
    const isCurrent = cur.exIdx === idx, allDone = done === steps.length;
    const row = document.createElement("div");
    row.className = "ov-row" + (isCurrent ? " ov-current" : "") + (allDone && !isCurrent ? " ov-done" : "");
    row.innerHTML = `
      <span class="ov-mark">${allDone ? "✓" : isCurrent ? "▶" : "○"}</span>
      <div class="ov-main">
        <div class="ov-name">${escapeHtml(ex.exerciseName)}${steps[0]?.cardio ? '<span class="mod-chip cardio">CARDIO</span>' : ""}</div>
        <div class="ov-meta">${done}/${steps.length} sets${ex.targetReps ? ` · ${escapeHtml(ex.targetReps)}` : ""}</div>
      </div>`;
    row.addEventListener("click", () => {
      closeModal("modal-overview");
      const first = session.steps.findIndex((s) => s.exIdx === idx);
      goToStep(first, first > session.i ? "next" : "prev");
    });
    body.appendChild(row);
  });
  openModal("modal-overview");
});

// ---------- rest timer ----------
let rest = null;
function startRest() {
  const overlay = document.getElementById("rest-overlay");
  rest = { left: REST_SECONDS, total: REST_SECONDS, paused: false, timer: null };
  overlay.classList.remove("hidden");
  mountMascots();
  const line = pickLine("restStart");
  document.getElementById("rest-mascot-line").textContent = line.t;
  setMascotMood(line.m, overlay);
  document.getElementById("rest-toggle").textContent = "Pause";
  updateRestUI();
  rest.timer = setInterval(() => {
    if (!rest || rest.paused) return;
    rest.left -= 1;
    if (rest.left <= 0) finishRest(true);
    else { if (rest.left <= 3) SFX.tick(); updateRestUI(); }
  }, 1000);
}
function updateRestUI() {
  if (!rest) return;
  const el = document.getElementById("rest-time");
  el.textContent = secsToClock(rest.left);
  el.classList.toggle("urgent", rest.left <= 10);
  document.getElementById("rest-ring-fg").style.strokeDashoffset = String(327 * (1 - rest.left / rest.total));
}
function finishRest(natural) {
  if (!rest) return;
  clearInterval(rest.timer);
  if (natural) { lsBump(LS.restsCompleted); SFX.restDone(); vibrate([40, 80, 40]); }
  else { lsBump(LS.restsSkipped); SFX.tap(); }
  hideRest();
  advanceAfterRest();
  checkAchievements();
}
function hideRest() {
  if (rest?.timer) clearInterval(rest.timer);
  rest = null;
  document.getElementById("rest-overlay").classList.add("hidden");
}
function advanceAfterRest() {
  if (!session) return;
  const prev = session.steps[session.i];
  goToStep(session.i + 1, "next");
  setTimeout(() => {
    const s = session?.steps[session.i];
    if (!s) return;
    if (s.exerciseId !== prev.exerciseId) saySession("exerciseDone", { exercise: prev.exerciseName });
    else saySession("restDone");
  }, 260);
}
document.getElementById("rest-skip").addEventListener("click", () => finishRest(false));
document.getElementById("rest-toggle").addEventListener("click", (e) => {
  if (!rest) return;
  rest.paused = !rest.paused;
  e.target.textContent = rest.paused ? "Resume" : "Pause";
});
document.getElementById("rest-plus").addEventListener("click", () => {
  if (!rest) return; rest.left += 30; rest.total = Math.max(rest.total, rest.left); updateRestUI();
});
document.getElementById("rest-minus").addEventListener("click", () => {
  if (!rest) return; rest.left = Math.max(1, rest.left - 30); updateRestUI();
});

// ============================= quick log =============================
let allExercisesCache = [], pickCallback = null, currentLogExercise = null;

async function openPickExerciseModal(onSelect) {
  pickCallback = onSelect || ((ex) => openLogSetsModal(ex));
  allExercisesCache = await dbGetAll("exercises");
  renderPickList(allExercisesCache);
  document.getElementById("pick-exercise-search").value = "";
  openModal("modal-pick-exercise");
}
document.getElementById("pick-exercise-search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  renderPickList(allExercisesCache.filter((ex) =>
    ex.name.toLowerCase().includes(q) || (ex.category || "").toLowerCase().includes(q) || (ex.equipment || "").toLowerCase().includes(q)));
});
function renderPickList(list) {
  const ul = document.getElementById("pick-exercise-list");
  ul.innerHTML = "";
  if (!list.length) { ul.innerHTML = `<li class="empty-state">No matches.</li>`; return; }
  [...list].sort((a, b) => a.name.localeCompare(b.name)).forEach((ex) => {
    const li = document.createElement("li");
    li.className = "entry-item entry-item-clickable";
    li.innerHTML = `<div class="entry-main"><span class="entry-title">${escapeHtml(ex.name)}${isCardio(ex) ? '<span class="mod-chip cardio">CARDIO</span>' : ""}</span><span class="entry-sub">${escapeHtml(ex.category)} · ${escapeHtml(ex.equipment)}</span></div><span class="entry-chevron">›</span>`;
    li.addEventListener("click", () => { closeModal("modal-pick-exercise"); pickCallback(ex); });
    ul.appendChild(li);
  });
}

async function openLogSetsModal(exercise, existingLog) {
  currentLogExercise = exercise;
  document.getElementById("log-sets-title").textContent = exercise.name;
  document.getElementById("sets-date").value = existingLog ? existingLog.date : todayStr();
  const rows = document.getElementById("sets-rows");
  rows.innerHTML = "";
  const initial = existingLog?.sets?.length ? existingLog.sets : [{}];
  initial.forEach((s) => addSetRow(s));
  document.getElementById("save-sets").dataset.editId = existingLog ? existingLog.id : "";

  const all = await dbGetAll("workoutLogs");
  const logs = all.filter((l) => l.exerciseId === exercise.id)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1)).slice(0, MAX_LOGS_PER_EXERCISE);
  const section = document.getElementById("recent-history-section");
  const list = document.getElementById("recent-history-list");
  list.innerHTML = "";
  if (!logs.length) section.classList.add("hidden");
  else {
    section.classList.remove("hidden");
    logs.forEach((w) => {
      const li = document.createElement("li");
      li.className = "entry-item";
      li.innerHTML = `
        <div class="entry-main"><span class="entry-title">${formatNiceDate(w.date)}</span><span class="entry-sub">${escapeHtml(w.sets.map(formatSet).join(", "))}</span></div>
        <button class="copy-btn" title="Copy into form">${COPY_ICON}</button>`;
      li.querySelector(".copy-btn").addEventListener("click", () => {
        rows.innerHTML = "";
        w.sets.forEach((s) => addSetRow(s));
        SFX.copy();
        showToast("Copied");
        vibrate(12);
      });
      list.appendChild(li);
    });
  }
  openModal("modal-log-sets");
}
document.getElementById("add-set-row").addEventListener("click", () => addSetRow({}));
function addSetRow(s = {}) {
  const cardio = isCardio(currentLogExercise);
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = cardio
    ? `<input type="text" class="text-input set-dur" placeholder="mm:ss" value="${s.duration ? secsToClock(s.duration) : ""}">
       <input type="number" inputmode="decimal" class="text-input set-dist" placeholder="km" step="0.1" value="${s.distance ?? ""}">
       <button class="set-remove">✕</button>`
    : `<input type="number" inputmode="numeric" class="text-input set-reps" placeholder="Reps" value="${s.reps ?? ""}">
       <input type="number" inputmode="decimal" class="text-input set-weight" placeholder="${s.bw ? "+kg" : "kg"}" value="${s.weight ?? ""}" step="0.5">
       <button class="set-remove">✕</button>`;
  row.querySelector(".set-remove").addEventListener("click", () => row.remove());
  document.getElementById("sets-rows").appendChild(row);
}
document.getElementById("save-sets").addEventListener("click", async () => {
  const date = document.getElementById("sets-date").value || todayStr();
  const cardio = isCardio(currentLogExercise);
  const sets = [...document.querySelectorAll("#sets-rows .set-row")].map((r) => cardio
    ? { duration: clockToSecs(r.querySelector(".set-dur").value), distance: parseFloat(r.querySelector(".set-dist").value) || 0 }
    : { reps: parseInt(r.querySelector(".set-reps").value, 10) || 0, weight: parseFloat(r.querySelector(".set-weight").value) || 0, bw: false }
  ).filter((s) => (cardio ? s.duration > 0 || s.distance > 0 : s.reps > 0 || s.weight > 0));
  if (!sets.length) return showToast("Add at least one set");

  const editId = document.getElementById("save-sets").dataset.editId;
  const payload = { date, exerciseId: currentLogExercise.id, exerciseName: currentLogExercise.name, sets };
  if (editId) { payload.id = parseInt(editId, 10); await dbPut("workoutLogs", payload); }
  else {
    payload.id = await dbAdd("workoutLogs", payload);
    await enforceLogRetention(currentLogExercise.id);
    if (!cardio) sets.forEach((s) => recordPRIfNew(currentLogExercise.id, s.weight));
  }
  recordLeaderboardEventForLog(payload);
  closeModal("modal-log-sets");
  showToast("Saved");
  await checkAchievements();
  refreshCurrentTab();
});

// ============================= PLANS =============================
document.getElementById("btn-new-plan").addEventListener("click", () => openPlanEditor(null));

async function renderPlansTab() {
  const plans = await dbGetAll("plans");
  const list = document.getElementById("plans-list");
  list.innerHTML = "";
  if (!plans.length) { list.innerHTML = `<li class="empty-state">No plans yet.</li>`; return; }
  plans.forEach((plan) => {
    const total = plan.splits.reduce((n, s) => n + s.exercises.length, 0);
    const li = document.createElement("li");
    li.className = "plan-card";
    li.innerHTML = `
      <div class="plan-card-name">${escapeHtml(plan.name)}</div>
      <div class="plan-card-meta">${plan.splits.length} splits · ${total} exercises</div>
      <div class="plan-split-chips">${plan.splits.map((s) => `<span class="split-chip">${escapeHtml(s.name)}</span>`).join("")}</div>`;
    li.addEventListener("click", () => openPlanDetail(plan));
    list.appendChild(li);
  });
}

let currentDetailPlan = null;
function openPlanDetail(plan) {
  currentDetailPlan = plan;
  document.getElementById("plan-detail-title").textContent = plan.name;
  const c = document.getElementById("plan-detail-splits");
  c.innerHTML = "";
  plan.splits.forEach((split) => {
    const row = document.createElement("div");
    row.className = "split-row";
    row.innerHTML = `
      <div class="split-row-top"><span class="split-row-name">${escapeHtml(split.name)}</span></div>
      <div class="split-row-exercises">${escapeHtml(split.exercises.map((e) => e.exerciseName).join(", ") || "No exercises yet")}</div>
      <button class="btn btn-primary btn-full split-start-btn">▶ Start ${escapeHtml(split.name)}</button>`;
    row.querySelector(".split-start-btn").addEventListener("click", () => {
      closeModal("modal-plan-detail");
      lsSet(LS.lastPlan, plan.id);
      startSession(plan, split);
    });
    c.appendChild(row);
  });
  openModal("modal-plan-detail");
}
document.getElementById("plan-detail-edit").addEventListener("click", () => { closeModal("modal-plan-detail"); openPlanEditor(currentDetailPlan); });
document.getElementById("plan-detail-delete").addEventListener("click", async () => {
  if (!currentDetailPlan) return;
  await dbDelete("plans", currentDetailPlan.id);
  closeModal("modal-plan-detail");
  showToast("Plan deleted");
  renderPlansTab();
});

let editorState = null;
function openPlanEditor(plan) {
  editorState = plan ? JSON.parse(JSON.stringify(plan)) : { name: "", splits: [{ name: "A", exercises: [] }] };
  document.getElementById("plan-editor-title").textContent = plan ? "Edit Plan" : "New Plan";
  document.getElementById("plan-name").value = editorState.name;
  renderPlanEditorSplits();
  openModal("modal-plan-editor");
}
function renderPlanEditorSplits() {
  const c = document.getElementById("plan-splits-container");
  c.innerHTML = "";
  editorState.splits.forEach((split, splitIdx) => {
    const block = document.createElement("div");
    block.className = "split-block";
    const header = document.createElement("div");
    header.className = "split-block-header";
    header.innerHTML = `<input type="text" class="text-input split-name-input" placeholder="Split name" value="${escapeHtml(split.name)}"><button class="split-remove-btn">Remove</button>`;
    header.querySelector(".split-name-input").addEventListener("input", (e) => { split.name = e.target.value; });
    header.querySelector(".split-remove-btn").addEventListener("click", () => { editorState.splits.splice(splitIdx, 1); renderPlanEditorSplits(); });
    block.appendChild(header);

    split.exercises.forEach((ex, exIdx) => {
      const cardio = ex.modality === "cardio";
      const row = document.createElement("div");
      row.className = "plan-ex-row";
      row.innerHTML = `
        <span class="plan-ex-name">${escapeHtml(ex.exerciseName)}</span>
        <input type="number" class="text-input plan-ex-sets" value="${ex.targetSets ?? (cardio ? 1 : 3)}" inputmode="numeric">
        <input type="text" class="text-input plan-ex-reps" value="${escapeHtml(ex.targetReps ?? (cardio ? "20 min" : "8-12"))}" placeholder="${cardio ? "target" : "reps"}">
        <button class="plan-ex-remove">✕</button>
        <div class="plan-ex-reorder"><button class="plan-ex-up">▲</button><button class="plan-ex-down">▼</button></div>`;
      row.querySelector(".plan-ex-sets").addEventListener("input", (e) => { ex.targetSets = parseInt(e.target.value, 10) || 0; });
      row.querySelector(".plan-ex-reps").addEventListener("input", (e) => { ex.targetReps = e.target.value; });
      row.querySelector(".plan-ex-remove").addEventListener("click", () => { split.exercises.splice(exIdx, 1); renderPlanEditorSplits(); });
      row.querySelector(".plan-ex-up").addEventListener("click", () => {
        if (exIdx === 0) return;
        [split.exercises[exIdx - 1], split.exercises[exIdx]] = [split.exercises[exIdx], split.exercises[exIdx - 1]];
        renderPlanEditorSplits();
      });
      row.querySelector(".plan-ex-down").addEventListener("click", () => {
        if (exIdx === split.exercises.length - 1) return;
        [split.exercises[exIdx + 1], split.exercises[exIdx]] = [split.exercises[exIdx], split.exercises[exIdx + 1]];
        renderPlanEditorSplits();
      });
      block.appendChild(row);
    });

    const add = document.createElement("button");
    add.className = "add-exercise-to-split-btn";
    add.textContent = "+ Add Exercise";
    add.addEventListener("click", () => openPickExerciseModal((ex) => {
      const cardio = isCardio(ex);
      split.exercises.push({
        exerciseId: ex.id, exerciseName: ex.name, modality: ex.modality || "strength",
        targetSets: cardio ? 1 : 3, targetReps: cardio ? "20 min" : "8-12",
      });
      renderPlanEditorSplits();
    }));
    block.appendChild(add);
    c.appendChild(block);
  });
}
document.getElementById("add-split-btn").addEventListener("click", () => {
  editorState.splits.push({ name: String.fromCharCode(65 + editorState.splits.length), exercises: [] });
  renderPlanEditorSplits();
});
document.getElementById("save-plan-btn").addEventListener("click", async () => {
  const name = document.getElementById("plan-name").value.trim();
  if (!name) return showToast("Enter a plan name");
  if (!editorState.splits.length) return showToast("Add at least one split");
  editorState.name = name;
  if (editorState.id) await dbPut("plans", editorState); else await dbAdd("plans", editorState);
  closeModal("modal-plan-editor");
  showToast("Plan saved");
  await checkAchievements();
  renderPlansTab();
});

// ============================= WEIGHT & STATS =============================
async function renderWeightTab() {
  const stats = await computeStats();
  const logs = [...stats.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1));

  const grid = document.getElementById("stat-grid");
  const boxes = [
    [stats.totalSetsLogged, "sets logged"],
    [stats.totalReps.toLocaleString(), "total reps"],
    [`${Math.round(stats.totalVolume).toLocaleString()}`, "kg moved"],
    [stats.totalSplitsCompleted, "splits done"],
    [stats.heaviestLift ? `${stats.heaviestLift}kg` : "—", "heaviest lift"],
    [stats.bestStreak, "best streak"],
    [secsToClock(stats.totalCardioSecs), "cardio time"],
    [`${stats.totalDistance.toFixed(1)}km`, "distance"],
  ];
  grid.innerHTML = boxes.map(([v, k]) => `<div class="stat-box"><div class="stat-val">${v}</div><div class="stat-key">${k}</div></div>`).join("");

  const list = document.getElementById("weight-history-list");
  list.innerHTML = "";
  if (!logs.length) list.innerHTML = `<li class="empty-state">No weight logged yet.</li>`;
  else logs.forEach((w) => {
    const li = document.createElement("li");
    li.className = "entry-item";
    li.innerHTML = `<div class="entry-main"><span class="entry-title">${w.weight} kg</span><span class="entry-sub">${formatNiceDate(w.date)}</span></div><button class="entry-delete">🗑</button>`;
    li.querySelector(".entry-delete").addEventListener("click", async () => {
      await dbDelete("weightLogs", w.id); showToast("Deleted"); renderWeightTab();
    });
    list.appendChild(li);
  });
  drawWeightChart(logs);
}
function drawWeightChart(logsDesc) {
  const canvas = document.getElementById("weight-chart");
  const empty = document.getElementById("weight-chart-empty");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w0 = canvas.parentElement.clientWidth - 32, h0 = 170;
  canvas.width = w0 * dpr; canvas.height = h0 * dpr;
  canvas.style.width = w0 + "px"; canvas.style.height = h0 + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w0, h0);

  const pts = [...logsDesc].sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-30);
  if (pts.length < 2) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const ws = pts.map((p) => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const pad = (max - min) * 0.15 || 1;
  const yMin = min - pad, yMax = max + pad;
  const mx = 8, my = 14, w = w0 - mx * 2, h = h0 - my * 2;
  const px = (i) => mx + (i / (pts.length - 1)) * w;
  const py = (v) => my + h - ((v - yMin) / (yMax - yMin)) * h;

  const grad = ctx.createLinearGradient(0, my, 0, my + h);
  grad.addColorStop(0, "rgba(255,45,77,0.35)");
  grad.addColorStop(1, "rgba(255,45,77,0)");
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.weight)) : ctx.moveTo(px(i), py(p.weight))));
  ctx.lineTo(px(pts.length - 1), my + h); ctx.lineTo(px(0), my + h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.strokeStyle = "#ff2d4d"; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.weight)) : ctx.moveTo(px(i), py(p.weight))));
  ctx.stroke();
  ctx.fillStyle = "#ff2d4d";
  pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(px(i), py(p.weight), 2.5, 0, Math.PI * 2); ctx.fill(); });
}

// ============================= CALENDAR =============================
let calCursor = new Date();
async function renderCalendar() {
  const [weightLogs, workoutLogs] = await Promise.all([dbGetAll("weightLogs"), dbGetAll("workoutLogs")]);
  const wD = new Set(weightLogs.map((w) => w.date)), xD = new Set(workoutLogs.map((w) => w.date));
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  document.getElementById("cal-month-label").textContent = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) {
    const b = document.createElement("div"); b.className = "cal-cell cal-cell-empty"; grid.appendChild(b);
  }
  const today = todayStr();
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const ds = toDateStr(new Date(y, m, d));
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (ds === today ? " cal-cell-today" : "");
    const dots = [];
    if (xD.has(ds)) dots.push('<i class="dot dot-exercise"></i>');
    if (wD.has(ds)) dots.push('<i class="dot dot-weight"></i>');
    cell.innerHTML = `<span class="cal-daynum">${d}</span><span class="cal-dots">${dots.join("")}</span>`;
    cell.addEventListener("click", () => openDayDetail(ds));
    grid.appendChild(cell);
  }
}
document.getElementById("cal-prev").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
document.getElementById("cal-next").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });

async function openDayDetail(ds) {
  const [weightLogs, workoutLogs] = await Promise.all([dbGetAll("weightLogs"), dbGetAll("workoutLogs")]);
  const dw = weightLogs.filter((w) => w.date === ds), dx = workoutLogs.filter((w) => w.date === ds);
  document.getElementById("day-detail-title").textContent = formatNiceDate(ds);
  const body = document.getElementById("day-detail-body");
  body.innerHTML = "";
  if (!dw.length && !dx.length) body.innerHTML = `<p class="empty-state">Nothing logged this day.</p>`;

  dw.forEach((w) => {
    const d = document.createElement("div");
    d.className = "card card-row";
    d.innerHTML = `<span class="card-label">Weight</span><span class="card-value">${w.weight} kg</span>`;
    body.appendChild(d);
  });

  const groups = new Map(), loose = [];
  dx.forEach((w) => {
    if (w.sessionId) {
      if (!groups.has(w.sessionId)) groups.set(w.sessionId, { splitName: w.splitName, planName: w.planName, entries: [] });
      groups.get(w.sessionId).entries.push(w);
    } else loose.push(w);
  });
  const item = (w) => {
    const d = document.createElement("div");
    d.className = "entry-item";
    d.innerHTML = `<div class="entry-main"><span class="entry-title">${escapeHtml(w.exerciseName)}</span><span class="entry-sub">${escapeHtml(w.sets.map(formatSet).join(", "))}</span></div>`;
    return d;
  };
  groups.forEach((g) => {
    const h = document.createElement("div");
    h.className = "session-group-heading";
    h.textContent = `${g.splitName} — ${g.planName}`;
    body.appendChild(h);
    g.entries.forEach((w) => body.appendChild(item(w)));
  });
  if (loose.length) {
    if (groups.size) { const h = document.createElement("div"); h.className = "session-group-heading"; h.textContent = "Other"; body.appendChild(h); }
    loose.forEach((w) => body.appendChild(item(w)));
  }

  const add = document.createElement("button");
  add.className = "btn btn-secondary btn-full";
  add.textContent = "+ Log Weight for this day";
  add.addEventListener("click", () => { closeModal("modal-day-detail"); openWeightModal(ds); });
  body.appendChild(add);
  openModal("modal-day-detail");
}

// ============================= EXERCISES =============================
let exFilter = { category: null, query: "" };
async function renderExercisesTab() {
  const exercises = await dbGetAll("exercises");
  const cats = [...new Set(exercises.map((e) => e.category))].sort();
  const chips = document.getElementById("exercise-filters");
  chips.innerHTML = "";
  chips.appendChild(makeChip("All", exFilter.category === null, () => { exFilter.category = null; renderExercisesTab(); }));
  cats.forEach((c) => chips.appendChild(makeChip(c, exFilter.category === c, () => { exFilter.category = c; renderExercisesTab(); })));
  filterExercises(exercises);
}
function makeChip(label, active, onClick) {
  const b = document.createElement("button");
  b.className = "chip" + (active ? " chip-active" : "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
document.getElementById("exercise-search").addEventListener("input", async (e) => {
  exFilter.query = e.target.value.toLowerCase();
  filterExercises(await dbGetAll("exercises"));
});
function filterExercises(list) {
  let f = list;
  if (exFilter.category) f = f.filter((e) => e.category === exFilter.category);
  if (exFilter.query) f = f.filter((e) => e.name.toLowerCase().includes(exFilter.query));
  const ul = document.getElementById("exercise-list");
  ul.innerHTML = "";
  if (!f.length) { ul.innerHTML = `<li class="empty-state">No exercises match.</li>`; return; }
  [...f].sort((a, b) => a.name.localeCompare(b.name)).forEach((ex) => {
    const li = document.createElement("li");
    li.className = "entry-item entry-item-clickable";
    li.innerHTML = `<div class="entry-main"><span class="entry-title">${escapeHtml(ex.name)}${isCardio(ex) ? '<span class="mod-chip cardio">CARDIO</span>' : ""}</span><span class="entry-sub">${escapeHtml(ex.category)} · ${escapeHtml(ex.equipment)}</span></div><span class="entry-chevron">›</span>`;
    li.addEventListener("click", () => openExerciseHistory(ex));
    ul.appendChild(li);
  });
}

let newExModality = "strength";
document.querySelectorAll(".mod-opt").forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll(".mod-opt").forEach((o) => o.classList.remove("mod-active"));
    opt.classList.add("mod-active");
    newExModality = opt.dataset.modality;
  });
});
document.getElementById("btn-add-custom-exercise").addEventListener("click", () => {
  ["custom-ex-name", "custom-ex-category", "custom-ex-equipment"].forEach((id) => (document.getElementById(id).value = ""));
  newExModality = "strength";
  document.querySelectorAll(".mod-opt").forEach((o) => o.classList.toggle("mod-active", o.dataset.modality === "strength"));
  openModal("modal-custom-exercise");
});
document.getElementById("save-custom-exercise").addEventListener("click", async () => {
  const name = document.getElementById("custom-ex-name").value.trim();
  if (!name) return showToast("Enter a name");
  await dbAdd("exercises", {
    name,
    category: document.getElementById("custom-ex-category").value.trim() || (newExModality === "cardio" ? "Cardio" : "Other"),
    equipment: document.getElementById("custom-ex-equipment").value.trim() || "None",
    modality: newExModality,
    canonicalId: slugify(name),
    romMeters: newExModality === "cardio" ? null : DEFAULT_ROM_METERS,
    custom: true,
  });
  closeModal("modal-custom-exercise");
  showToast("Exercise added");
  await checkAchievements();
  renderExercisesTab();
});

async function openExerciseHistory(exercise) {
  const all = await dbGetAll("workoutLogs");
  const logs = all.filter((l) => l.exerciseId === exercise.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  document.getElementById("exercise-history-title").textContent = exercise.name;
  const body = document.getElementById("exercise-history-body");
  body.innerHTML = "";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-full";
  btn.textContent = "+ Log this exercise";
  btn.addEventListener("click", () => { closeModal("modal-exercise-history"); openLogSetsModal(exercise); });
  body.appendChild(btn);

  // modality can be switched later (e.g. turn Plank into a timed exercise)
  const modBtn = document.createElement("button");
  modBtn.className = "btn btn-secondary btn-full";
  modBtn.textContent = isCardio(exercise) ? "Switch to Strength (reps & kg)" : "Switch to Cardio (time & km)";
  modBtn.addEventListener("click", async () => {
    exercise.modality = isCardio(exercise) ? "strength" : "cardio";
    exercise.romMeters = exercise.modality === "cardio" ? null : (exercise.romMeters ?? DEFAULT_ROM_METERS);
    await dbPut("exercises", exercise);
    closeModal("modal-exercise-history");
    showToast(`Now a ${exercise.modality} exercise`);
    renderExercisesTab();
  });
  body.appendChild(modBtn);

  const prs = lsGet(LS.prs, {});
  if (!isCardio(exercise) && prs[exercise.id]) {
    const pr = document.createElement("div");
    pr.className = "card card-row";
    pr.innerHTML = `<span class="card-label">Personal Record</span><span class="card-value">${prs[exercise.id]} kg</span>`;
    body.appendChild(pr);
  }
  if (!logs.length) {
    const p = document.createElement("p"); p.className = "empty-state"; p.textContent = "No history yet."; body.appendChild(p);
  } else logs.forEach((w) => {
    const d = document.createElement("div");
    d.className = "entry-item entry-item-clickable";
    d.innerHTML = `<div class="entry-main"><span class="entry-title">${formatNiceDate(w.date)}</span><span class="entry-sub">${escapeHtml(w.sets.map(formatSet).join(", "))}</span></div><span class="entry-chevron">›</span>`;
    d.addEventListener("click", () => { closeModal("modal-exercise-history"); openLogSetsModal(exercise, w); });
    body.appendChild(d);
  });
  openModal("modal-exercise-history");
}

// ============================= Red Flag Court lockout =============================

document.getElementById("btn-lockout-delete").addEventListener("click", () => {
  document.getElementById("btn-lockout-delete").classList.add("hidden");
  document.getElementById("btn-lockout-delete-confirm").classList.remove("hidden");
});
document.getElementById("btn-lockout-delete-confirm").addEventListener("click", () => { deleteAllMyData(); });

function showLockoutScreen() {
  document.querySelector("header.topbar").classList.add("hidden");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("lockout-screen").classList.remove("hidden");
}

// ============================= boot =============================

// ============================= Personalize (mascot + theme pickers) =============================
function renderPersonalizePickers() {
  const mascotRow = document.getElementById("mascot-picker");
  mascotRow.innerHTML = "";
  const activeMascot = getMascotId();
  Object.entries(MASCOTS).forEach(([id, mascot]) => {
    const btn = document.createElement("button");
    btn.className = "mascot-option" + (id === activeMascot ? " is-active" : "");
    btn.innerHTML = `<span class="mascot-option-thumb">${mascot.svg}</span><span class="mascot-option-name">${escapeHtml(mascot.name)}</span>`;
    btn.addEventListener("click", () => {
      if (id === getMascotId()) return;
      SFX.tap();
      setMascotId(id);
      renderPersonalizePickers();
      refreshCurrentTab();
    });
    mascotRow.appendChild(btn);
  });

  const themeRow = document.getElementById("theme-picker");
  themeRow.innerHTML = "";
  const activeTheme = getThemeId();
  Object.entries(THEMES).forEach(([id, theme]) => {
    const btn = document.createElement("button");
    btn.className = "theme-option" + (id === activeTheme ? " is-active" : "");
    const swatchDots = theme.swatch.map((c) => `<span style="background:${c}"></span>`).join("");
    btn.innerHTML = `<span class="theme-swatch">${swatchDots}</span><span class="theme-option-name">${escapeHtml(theme.name)}</span>`;
    btn.addEventListener("click", () => {
      if (id === getThemeId()) return;
      SFX.tap();
      setThemeId(id);
      renderPersonalizePickers();
    });
    themeRow.appendChild(btn);
  });
}

(async function init() {
  mountMascots();
  renderPersonalizePickers();
  await openDB();
  await seedExercisesIfEmpty();
  // Unconditional and early: this previously sat after the lockout check,
  // so a locked-out device could never (re)register the service worker and
  // would keep serving whatever it last cached indefinitely.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  // The whole identity/social layer is wrapped in one try/catch — this app
  // was fully offline-functional before social features existed, and a
  // WebCrypto failure (e.g. a non-secure context, where crypto.subtle is
  // undefined) shouldn't take core workout tracking down with it.
  let lockedOut = false;
  try {
    // Captured before getOrCreateIdentity() below (which creates the record
    // on first run) so onboarding can tell "brand-new device" apart from
    // "identity already existed" — an existing identity is grandfathered
    // past onboarding rather than shown it retroactively.
    const isFirstEverIdentity = !(await dbGet("identity", 1));
    await getOrCreateIdentity();

    try {
      if (await completeDriveAuthIfRedirected()) {
        showToast("Connected to Google Drive");
        if (typeof renderBackupCard === "function") renderBackupCard();
      }
    } catch (err) {
      showToast(err.message || "Google sign-in failed");
    }

    if (typeof runOnboardingIfNeeded === "function") await runOnboardingIfNeeded(isFirstEverIdentity);

    lockedOut = await checkEscalationAndLockout();
    if (!lockedOut) await applyModerationConsequences();
  } catch (err) {
    console.error("Social/identity init failed — continuing in offline-only mode.", err);
  }

  if (lockedOut) { showLockoutScreen(); return; }

  await renderHome();
  await checkAchievements();
})();
