/* Chiptune sound engine — everything synthesized with Web Audio,
   zero audio files, fits the 90s pixel aesthetic. All sounds are short,
   square/triangle-wave blips mixed quiet so they read as "game feedback"
   rather than noise. Muted state persists in localStorage. */

const SFX_LS_KEY = "ft_muted";
let _audioCtx = null;
let _muted = (() => { try { return JSON.parse(localStorage.getItem(SFX_LS_KEY) || "false"); } catch { return false; } })();

function _ctx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  // iOS suspends the context until a user gesture; every sfx call comes from
  // a tap anyway, so resume inline.
  if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

function sfxMuted() { return _muted; }
function sfxSetMuted(m) {
  _muted = !!m;
  localStorage.setItem(SFX_LS_KEY, JSON.stringify(_muted));
}

// Core voice: one oscillator note with a quick envelope.
function _note(ctx, { freq = 440, type = "square", t = 0, dur = 0.08, vol = 0.06, slideTo = null }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const start = ctx.currentTime + t;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// Noise burst for percussive accents (achievement "hit", timer end).
function _noise(ctx, { t = 0, dur = 0.1, vol = 0.04 }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + t);
}

const SFX = {
  // soft UI tick — steppers, toggles, chips
  tap()        { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 880, dur: 0.04, vol: 0.03 }); },

  // navigating pages / opening sheets
  swipe()      { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 520, slideTo: 780, type: "triangle", dur: 0.09, vol: 0.04 }); },

  // set logged — rising two-note confirm
  log()        { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 660, dur: 0.07 });
    _note(c, { freq: 990, t: 0.07, dur: 0.09 }); },

  // copy button
  copy()       { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 1180, dur: 0.05, vol: 0.04 });
    _note(c, { freq: 1180, t: 0.07, dur: 0.05, vol: 0.04 }); },

  // new personal record — short fanfare
  pr()         { const c = _ctx(); if (!c || _muted) return;
    [523, 659, 784, 1047].forEach((f, i) => _note(c, { freq: f, t: i * 0.09, dur: 0.12, vol: 0.055 }));
    _noise(c, { t: 0.36, dur: 0.15, vol: 0.02 }); },

  // achievement unlocked — grand arpeggio
  achievement(){ const c = _ctx(); if (!c || _muted) return;
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => _note(c, { freq: f, t: i * 0.08, dur: 0.14, vol: 0.05 }));
    _noise(c, { t: 0.48, dur: 0.2, vol: 0.025 }); },

  // split finished — victory phrase
  victory()    { const c = _ctx(); if (!c || _muted) return;
    const seq = [[659,0.00],[659,0.10],[659,0.20],[523,0.30],[659,0.42],[784,0.56]];
    seq.forEach(([f, t]) => _note(c, { freq: f, t, dur: 0.12, vol: 0.055 }));
    _note(c, { freq: 1047, t: 0.72, dur: 0.3, vol: 0.06, type: "triangle" }); },

  // rest timer: last-3-seconds tick and final bell
  tick()       { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 1320, dur: 0.03, vol: 0.035 }); },
  restDone()   { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 880, dur: 0.1 });
    _note(c, { freq: 1108, t: 0.1, dur: 0.1 });
    _note(c, { freq: 1318, t: 0.2, dur: 0.22, type: "triangle", vol: 0.06 }); },

  // skipping / quitting — descending "aww"
  skip()       { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 494, dur: 0.09 });
    _note(c, { freq: 370, t: 0.09, dur: 0.13, vol: 0.05 }); },

  // weight logged
  weight()     { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 587, type: "triangle", dur: 0.09, vol: 0.05 });
    _note(c, { freq: 880, t: 0.09, dur: 0.11, type: "triangle", vol: 0.05 }); },

  // stopwatch start/stop
  swStart()    { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 660, slideTo: 990, dur: 0.1, vol: 0.045 }); },
  swStop()     { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 990, slideTo: 660, dur: 0.1, vol: 0.045 }); },

  // error / invalid input
  error()      { const c = _ctx(); if (!c || _muted) return;
    _note(c, { freq: 220, type: "sawtooth", dur: 0.12, vol: 0.04 });
    _note(c, { freq: 208, t: 0.1, type: "sawtooth", dur: 0.14, vol: 0.04 }); },
};

// ============================= Red Flag Court consequence =============================
// A low sawtooth with a downward pitch ramp plus a burst of noise reads as
// "fart" using the same oscillator/noise primitives as every other sound
// here — no audio files, same synthesis approach as the rest of this file.
function _fart(ctx, { t = 0, dur = 0.3, vol = 0.05 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  const start = ctx.currentTime + t;
  const startFreq = 130 + Math.random() * 40;
  osc.frequency.setValueAtTime(startFreq, start);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.35, start + dur);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  _noise(ctx, { t, dur: dur * 0.6, vol: vol * 0.4 });
}

const _originalSFX = {};
let _fartModeActive = false;

// While a user is consequentially flagged (moderation.js), every sound
// effect in this file is swapped for a fart variant — reversible, so
// clearing the flag (or a court win) restores normal sounds exactly.
function setFartMode(active) {
  if (active === _fartModeActive) return;
  _fartModeActive = active;
  if (active) {
    Object.keys(SFX).forEach((name) => {
      _originalSFX[name] = SFX[name];
      SFX[name] = () => { const c = _ctx(); if (!c || _muted) return; _fart(c, { dur: 0.22 + Math.random() * 0.25 }); };
    });
  } else {
    Object.keys(_originalSFX).forEach((name) => { SFX[name] = _originalSFX[name]; });
  }
}
