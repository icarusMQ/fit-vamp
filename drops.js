/* Drops — the physics-based point currency behind the social leaderboards
   (see .claude/plans/social-leaderboards.md). Deliberately simplified
   physics: good enough to be explainable and hard to game by accident, not
   meant to survive a physics PhD's scrutiny. Constants below are starting
   points and will likely need retuning once real usage data exists.

   Every set you log turns into one signed-by-context "Drops event" that
   this device caches locally (leaderboardEvents) and broadcasts to every
   paired friend (sync.js). Leaderboards are pure aggregations over that
   local cache — nothing here ever asks another device for a number. */

const G = 9.81;

// Two different divisors, not one — strength and cardio Drops start from
// physically different quantities (mechanical work per set vs. total
// metabolic energy per session) that land in wildly different Joule
// magnitudes for an equally hard effort. A heavy 8-rep bench set is ~3.5kJ
// of mechanical work; a moderate 5km run is ~1,460kJ of metabolic energy —
// off by ~400x. STRENGTH_DROPS_DIVISOR is tuned so one hard set lands
// around 50-100 Drops; CARDIO_DROPS_DIVISOR is tuned so one solid session
// (not one set — cardio is logged per-session) lands in roughly the same
// few-hundred-to-low-thousands range as a full multi-exercise strength
// session's running total. Still an approximation, still worth revisiting
// once real usage data exists — but not the ~400x-off version.
const STRENGTH_DROPS_DIVISOR = 50;
const CARDIO_DROPS_DIVISOR = 1000;
const KCAL_TO_JOULES = 4184;
const CARDIO_BASELINE_KMH = 8; // an 8km/h jog is the pace-intensity neutral point
const ISOMETRIC_KCAL_PER_KG_HOUR = 3; // rough resting/isometric-hold metabolic rate
const DEFAULT_BODYWEIGHT_KG = 70; // matches computeStats()'s existing fallback

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// mass_kg * g * range-of-motion * reps — a work-energy approximation.
// Bodyweight exercises (push-ups, weighted dips, ...) fall out of the same
// formula: `bw` means "weight is added on top of bodyweight," so
// mass = bodyweight + weight, same as the app's existing formatSet() reads it.
function dropsForStrengthSet(set, exercise, bodyweightKg) {
  const massKg = (set.weight || 0) + (set.bw ? bodyweightKg : 0);
  const reps = set.reps || 0;
  const rom = exercise.romMeters;
  if (massKg <= 0 || reps <= 0 || !rom || rom <= 0) return 0;
  return (massKg * G * rom * reps) / STRENGTH_DROPS_DIVISOR;
}

// Distance-based cardio uses the standard exercise-science approximation
// that horizontal locomotion costs ~1 kcal/kg/km, scaled by how much faster
// than a jog the pace was. Distance-less holds (planks, ...) have no pace
// signal to work with, so they fall back to a flat isometric metabolic-rate
// estimate instead — rougher than the distance-based formula, flagged as an
// open calibration question in the plan.
function dropsForCardioSet(set, bodyweightKg) {
  const distanceKm = set.distance || 0;
  const durationHr = (set.duration || 0) / 3600;
  if (distanceKm > 0) {
    const energyJ = bodyweightKg * distanceKm * KCAL_TO_JOULES;
    const paceKmh = durationHr > 0 ? distanceKm / durationHr : CARDIO_BASELINE_KMH;
    const intensity = clamp(paceKmh / CARDIO_BASELINE_KMH, 0.7, 2.0);
    return (energyJ / CARDIO_DROPS_DIVISOR) * intensity;
  }
  if (durationHr > 0) {
    const energyJ = bodyweightKg * durationHr * ISOMETRIC_KCAL_PER_KG_HOUR * KCAL_TO_JOULES;
    return energyJ / CARDIO_DROPS_DIVISOR;
  }
  return 0;
}

function dropsForLog(workoutLog, exercise, bodyweightKg) {
  const cardio = (exercise.modality || "strength") === "cardio";
  return workoutLog.sets.reduce(
    (sum, set) => sum + (cardio ? dropsForCardioSet(set, bodyweightKg) : dropsForStrengthSet(set, exercise, bodyweightKg)),
    0
  );
}

async function currentBodyweightKg() {
  const logs = await dbGetAll("weightLogs");
  if (!logs.length) return DEFAULT_BODYWEIGHT_KG;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted[sorted.length - 1].weight;
}

// Called after every workoutLogs write (new set or edit). Computes this
// log's Drops, caches the event locally, and hands it to sync.js to
// broadcast — fire-and-forget from the caller's perspective, so a logging
// session never waits on network/crypto work.
async function recordLeaderboardEventForLog(workoutLog) {
  try {
    const exercise = await dbGet("exercises", workoutLog.exerciseId);
    if (!exercise) return;
    const bodyweightKg = await currentBodyweightKg();
    const drops = dropsForLog(workoutLog, exercise, bodyweightKg);
    const identity = await getOrCreateIdentity();
    const event = {
      id: `${identity.pubkeyB64}:wlog-${workoutLog.id}`,
      authorPubkey: identity.pubkeyB64,
      type: "set",
      canonicalExerciseId: exercise.canonicalId,
      modality: exercise.modality || "strength",
      drops,
      date: workoutLog.date,
      sessionId: workoutLog.sessionId || null,
      ts: Date.now(),
    };
    await dbPut("leaderboardEvents", event);
    if (typeof broadcastToAllFriends === "function") await broadcastToAllFriends("workout-event", event);
    if (typeof refreshCurrentTab === "function") refreshCurrentTab();
  } catch (err) {
    console.error("recordLeaderboardEventForLog failed", err);
  }
}

// ============================= leaderboards (pure) =============================
//
// Every leaderboard takes the same optional `filters` shape so metric,
// window, and demographic slice compose freely instead of needing a
// separate function per combination:
//   { since, until }      — inclusive "YYYY-MM-DD" date bounds, either omittable
//   { pubkeys }            — a Set of authorPubkeys to include; omit for everyone
//   { flaggedPubkeys }     — a Set of Red Flag Court-flagged pubkeys (moderation.js);
//                            their Drops-denominated rows count at 20% while flagged.
//                            Doesn't apply to consistency — that's a day count, not Drops.

function inWindow(dateStr, since, until) {
  if (since && dateStr < since) return false;
  if (until && dateStr > until) return false;
  return true;
}

function passesFilters(e, { since, until, pubkeys } = {}) {
  if (e.type !== "set") return false;
  if (pubkeys && !pubkeys.has(e.authorPubkey)) return false;
  if (!inWindow(e.date, since, until)) return false;
  return true;
}

// Exempts filters.viewerPubkey from the multiplier — per the design (see
// moderation.js's header), the 0.2x penalty is what *other* people see, not
// something a flagged user's own device applies to their own numbers.
function dropsMultiplierFor(pubkey, flaggedPubkeys, viewerPubkey) {
  if (pubkey === viewerPubkey) return 1;
  return flaggedPubkeys && flaggedPubkeys.has(pubkey) ? FLAGGED_DROPS_MULTIPLIER : 1;
}

function computeTotalDropsLeaderboard(events, filters = {}) {
  const totals = new Map();
  for (const e of events) {
    if (!passesFilters(e, filters)) continue;
    totals.set(e.authorPubkey, (totals.get(e.authorPubkey) || 0) + (e.drops || 0));
  }
  return [...totals.entries()].map(([pubkey, value]) => ({ pubkey, value: value * dropsMultiplierFor(pubkey, filters.flaggedPubkeys, filters.viewerPubkey) }));
}

function computeExerciseLeaderboard(events, canonicalExerciseId, filters = {}) {
  const totals = new Map();
  for (const e of events) {
    if (e.canonicalExerciseId !== canonicalExerciseId || !passesFilters(e, filters)) continue;
    totals.set(e.authorPubkey, (totals.get(e.authorPubkey) || 0) + (e.drops || 0));
  }
  return [...totals.entries()].map(([pubkey, value]) => ({ pubkey, value: value * dropsMultiplierFor(pubkey, filters.flaggedPubkeys, filters.viewerPubkey) }));
}

function computeConsistencyLeaderboard(events, filters) {
  const datesByAuthor = new Map();
  for (const e of events) {
    if (!passesFilters(e, filters)) continue;
    if (!datesByAuthor.has(e.authorPubkey)) datesByAuthor.set(e.authorPubkey, new Set());
    datesByAuthor.get(e.authorPubkey).add(e.date);
  }
  return [...datesByAuthor.entries()].map(([pubkey, dates]) => ({ pubkey, value: dates.size }));
}

// Canonical exercise ids one specific author has logged — used to populate
// the "which exercise" picker with only things that author actually does.
function listLoggedExercises(events, authorPubkey) {
  const mine = events.filter((e) => e.type === "set" && e.authorPubkey === authorPubkey && e.canonicalExerciseId);
  return [...new Set(mine.map((e) => e.canonicalExerciseId))];
}

// ============================= time windows =============================

const FIVE_MONTH_EPOCH = "2026-01-01"; // shared constant so every device buckets identically without asking a server

function addMonthsStr(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = ((total % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthlyWindow(nowStr) {
  const [y, m] = nowStr.split("-");
  return { since: `${y}-${m}-01`, until: nowStr, label: "This Month" };
}

function fiveMonthWindow(nowStr) {
  const [ey, em] = FIVE_MONTH_EPOCH.split("-").map(Number);
  const [ny, nm] = nowStr.split("-").map(Number);
  const monthsSinceEpoch = ny * 12 + (nm - 1) - (ey * 12 + (em - 1));
  const bucketIndex = Math.floor(monthsSinceEpoch / 5);
  return { since: addMonthsStr(FIVE_MONTH_EPOCH, bucketIndex * 5), until: nowStr, label: "This Cycle" };
}

function windowFor(kind, nowStr) {
  if (kind === "month") return monthlyWindow(nowStr);
  if (kind === "cycle") return fiveMonthWindow(nowStr);
  return { since: undefined, until: undefined, label: "All-Time" };
}

// ============================= demographic brackets =============================

const LEVEL_TIERS = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 1000 },
  { name: "Gold", min: 5000 },
  { name: "Platinum", min: 20000 },
]; // rough starting thresholds — see the plan's open questions, needs real usage data to tune

function levelBracketFor(cumulativeDrops) {
  let current = LEVEL_TIERS[0].name;
  for (const tier of LEVEL_TIERS) if (cumulativeDrops >= tier.min) current = tier.name;
  return current;
}

const HEIGHT_BRACKETS = [
  { name: "<165cm", max: 165 },
  { name: "165-175cm", max: 175 },
  { name: "175-185cm", max: 185 },
  { name: "185cm+", max: Infinity },
];

function heightBracketFor(heightCm) {
  if (!(heightCm > 0)) return null;
  return HEIGHT_BRACKETS.find((b) => heightCm < b.max).name;
}
