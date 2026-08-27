/* First-boot onboarding — a short, skippable, in-character walkthrough that
   runs once on a brand-new device: name yourself, optionally connect a
   relay, then a quick tour. Gated the same way showLockoutScreen() gates
   the lockout screen in app.js's init(). See issue #4.

   Existing identities (created before this feature shipped) are
   grandfathered past onboarding rather than shown it retroactively — see
   runOnboardingIfNeeded's `isFirstEverIdentity` argument, set by app.js's
   init() before it calls getOrCreateIdentity(). */

const ONBOARDING_LS_KEY = "ft_onboarded"; // shared literal with app.js's LS.onboarded

let onboardingResolve = null;
let onboardingTourIndex = 0;

// Called once from init(), inside the same try/catch as the rest of the
// identity/social layer — a WebCrypto failure here shouldn't block the app
// any more than it already doesn't for the rest of that layer.
async function runOnboardingIfNeeded(isFirstEverIdentity) {
  if (localStorage.getItem(ONBOARDING_LS_KEY)) return;
  if (!isFirstEverIdentity) {
    localStorage.setItem(ONBOARDING_LS_KEY, "1");
    return;
  }
  return new Promise((resolve) => {
    onboardingResolve = resolve;
    openOnboardingScreen();
    showOnboardingStepName();
  });
}

// Re-entry for someone who skipped (or wants to redo it) — Friends tab →
// their identity card. Doesn't touch the ft_onboarded flag on open, only on
// completion, so backing out mid-replay via the header/back isn't possible
// (by design: same "always finishable" flow as first boot) but simply not
// finishing it just leaves things as they already were.
function replayOnboarding() {
  openOnboardingScreen();
  showOnboardingStepName();
}

function openOnboardingScreen() {
  document.querySelector("header.topbar").classList.add("hidden");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("onboarding-screen").classList.remove("hidden");
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_LS_KEY, "1");
  document.getElementById("onboarding-screen").classList.add("hidden");
  document.querySelector("header.topbar").classList.remove("hidden");
  document.getElementById("app").classList.remove("hidden");
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof refreshCurrentTab === "function") refreshCurrentTab();
  if (onboardingResolve) { const r = onboardingResolve; onboardingResolve = null; r(); }
}

function showOnboardingStep(name) {
  document.querySelectorAll(".onboarding-step").forEach((el) => el.classList.toggle("hidden", el.dataset.step !== name));
}

function setOnboardingLine(mood, text) {
  document.getElementById("onboarding-line").textContent = text;
  setMascotMood(mood, document.getElementById("onboarding-screen"));
}

// ============================= step 1: name =============================

async function showOnboardingStepName() {
  showOnboardingStep("name");
  setOnboardingLine(ONBOARDING_GREETING.m, ONBOARDING_GREETING.t);
  const identity = await getOrCreateIdentity();
  document.getElementById("onboarding-username-input").value = identity.username === "Athlete" ? "" : identity.username;
  updateOnboardingPreview(identity.userTag);
}

function updateOnboardingPreview(tag) {
  const input = document.getElementById("onboarding-username-input");
  const name = input.value.trim().slice(0, 24) || "Athlete";
  document.getElementById("onboarding-name-preview").textContent = `${name}#${tag}`;
}

document.getElementById("onboarding-username-input").addEventListener("input", async () => {
  const identity = await getOrCreateIdentity();
  updateOnboardingPreview(identity.userTag);
});

document.getElementById("onboarding-name-next").addEventListener("click", async () => {
  SFX.tap();
  const name = document.getElementById("onboarding-username-input").value.trim();
  if (name) await setUsername(name);
  showOnboardingStepRelay();
});

// ============================= step 2: relay =============================

function showOnboardingStepRelay() {
  showOnboardingStep("relay");
  setOnboardingLine(ONBOARDING_RELAY_PITCH.m, ONBOARDING_RELAY_PITCH.t);
  document.getElementById("onboarding-relay-custom-row").classList.add("hidden");
  document.getElementById("onboarding-relay-input").value = "";
}

document.getElementById("onboarding-relay-standard").addEventListener("click", () => {
  SFX.tap();
  applyOnboardingRelayUrl(DEFAULT_RELAY_URL);
  showToast("Connecting to the standard relay…");
  showOnboardingStepTour();
});

document.getElementById("onboarding-relay-custom-toggle").addEventListener("click", () => {
  SFX.tap();
  document.getElementById("onboarding-relay-custom-row").classList.toggle("hidden");
});

document.getElementById("onboarding-relay-custom-save").addEventListener("click", () => {
  const url = document.getElementById("onboarding-relay-input").value.trim();
  if (!url) return showToast("Paste a relay URL first");
  if (!/^wss?:\/\//.test(url)) return showToast("URL must start with ws:// or wss://");
  SFX.tap();
  applyOnboardingRelayUrl(url);
  showToast("Connecting to relay…");
  showOnboardingStepTour();
});

// Also mirrors into the Friends → Sync input so it doesn't show blank /
// the placeholder next time someone opens that tab after onboarding set it.
function applyOnboardingRelayUrl(url) {
  setRelayUrl(url);
  const syncInput = document.getElementById("relay-url-input");
  if (syncInput) syncInput.value = url;
  disconnectRelay();
  connectRelay();
}

document.getElementById("onboarding-relay-skip").addEventListener("click", () => {
  SFX.tap();
  showOnboardingStepTour();
});

// ============================= step 3: tour =============================

function currentTourBeats() {
  const connected = !!getRelayUrl();
  return connected ? ONBOARDING_TOUR : ONBOARDING_TOUR.filter((b) => !b.needsRelay);
}

function showOnboardingStepTour() {
  showOnboardingStep("tour");
  onboardingTourIndex = 0;
  renderOnboardingTourBeat();
}

function renderOnboardingTourBeat() {
  const beats = currentTourBeats();
  const beat = beats[onboardingTourIndex];
  setOnboardingLine(beat.m, beat.t);
  document.getElementById("onboarding-tour-caption").textContent = beat.caption;
  document.getElementById("onboarding-tour-dots").innerHTML = beats
    .map((_, i) => `<span class="onboarding-dot${i === onboardingTourIndex ? " onboarding-dot-active" : ""}"></span>`)
    .join("");
  document.getElementById("onboarding-tour-next").textContent = onboardingTourIndex === beats.length - 1 ? "Let's go" : "Next";
}

document.getElementById("onboarding-tour-next").addEventListener("click", () => {
  SFX.tap();
  const beats = currentTourBeats();
  if (onboardingTourIndex < beats.length - 1) { onboardingTourIndex++; renderOnboardingTourBeat(); }
  else finishOnboarding();
});

document.getElementById("onboarding-tour-skip").addEventListener("click", () => {
  SFX.tap();
  finishOnboarding();
});

// ============================= settings re-entry =============================

document.getElementById("btn-replay-onboarding").addEventListener("click", () => {
  SFX.swipe();
  replayOnboarding();
});
