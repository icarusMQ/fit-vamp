/* Vesper — the app's mascot. One SVG string reused wherever she appears,
   with mood driven by a CSS class on the <svg> element. */

const MASCOT_SVG = `
<svg class="mascot-svg mood-idle" viewBox="0 0 128 148" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vesperGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b1d47"/>
      <stop offset="100%" stop-color="#20102b"/>
    </linearGradient>
    <linearGradient id="cloakGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a1338"/>
      <stop offset="100%" stop-color="#160a1f"/>
    </linearGradient>
    <linearGradient id="wingGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4a1f52"/>
      <stop offset="100%" stop-color="#1b0d25"/>
    </linearGradient>
  </defs>

  <ellipse cx="64" cy="72" rx="60" ry="60" fill="url(#vesperGlow)" class="v-aura"/>

  <!-- wings -->
  <g class="v-wing v-wing-l">
    <path d="M32 82 C 14 62, 6 70, 4 58 C 12 66, 14 60, 12 52
             C 20 64, 22 58, 22 50 C 30 64, 34 70, 36 76 Z"
          fill="url(#wingGrad)" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
    <path d="M30 78 C 20 68, 16 68, 14 62 C 20 66, 22 62, 21 57 C 26 65, 28 66, 30 70 Z" fill="#6b2a5e" opacity="0.55"/>
  </g>
  <g class="v-wing v-wing-r">
    <path d="M96 82 C 114 62, 122 70, 124 58 C 116 66, 114 60, 116 52
             C 108 64, 106 58, 106 50 C 98 64, 94 70, 92 76 Z"
          fill="url(#wingGrad)" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
    <path d="M98 78 C 108 68, 112 68, 114 62 C 108 66, 106 62, 107 57 C 102 65, 100 66, 98 70 Z" fill="#6b2a5e" opacity="0.55"/>
  </g>

  <!-- body / cloak -->
  <path class="v-body" d="M40 108 C 38 124, 36 134, 34 142 L 94 142 C 92 134, 90 124, 88 108 Z"
        fill="url(#cloakGrad)" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
  <path d="M46 116 L 64 124 L 82 116 L 82 121 L 64 129 L 46 121 Z" fill="#c81e3a"/>
  <circle cx="64" cy="112" r="4.5" fill="#f2c14e" stroke="#0d0612" stroke-width="1.5"/>
  <path d="M64 116 L 61 124 L 64 122 L 67 124 Z" fill="#f2c14e"/>

  <!-- hair back -->
  <path d="M28 62 C 24 26, 44 12, 64 12 C 84 12, 104 26, 100 62
           C 100 44, 96 34, 88 30 L 40 30 C 32 34, 28 44, 28 62 Z"
        fill="url(#hairGrad)" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>

  <!-- ears -->
  <path d="M34 34 L 24 12 L 44 28 Z" fill="#2b1533" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
  <path d="M35 30 L 30 17 L 41 27 Z" fill="#e8879a" opacity="0.85"/>
  <path d="M94 34 L 104 12 L 84 28 Z" fill="#2b1533" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
  <path d="M93 30 L 98 17 L 87 27 Z" fill="#e8879a" opacity="0.85"/>

  <!-- face -->
  <path d="M36 56 C 36 34, 48 26, 64 26 C 80 26, 92 34, 92 56
           C 92 78, 80 92, 64 92 C 48 92, 36 78, 36 56 Z"
        fill="#f6e3da" stroke="#0d0612" stroke-width="2"/>

  <!-- hair front / bangs -->
  <path d="M34 56 C 32 32, 46 20, 64 20 C 82 20, 96 32, 94 56
           C 92 44, 88 38, 84 36 C 80 44, 74 46, 64 42
           C 56 46, 48 44, 44 36 C 40 38, 36 44, 34 56 Z"
        fill="url(#hairGrad)" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
  <path d="M50 26 C 54 30, 58 32, 62 32 C 56 34, 52 32, 50 26 Z" fill="#5c2f6b" opacity="0.7"/>

  <!-- blush -->
  <ellipse class="v-blush" cx="46" cy="70" rx="7" ry="4.5" fill="#e8879a" opacity="0.6"/>
  <ellipse class="v-blush" cx="82" cy="70" rx="7" ry="4.5" fill="#e8879a" opacity="0.6"/>

  <!-- EYES -->
  <g class="face-part eyes-open">
    <ellipse cx="52" cy="60" rx="8" ry="9" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="8" ry="9" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="5.5" ry="6.5" fill="#c81e3a"/>
    <ellipse cx="76" cy="61" rx="5.5" ry="6.5" fill="#c81e3a"/>
    <circle cx="52" cy="61" r="2.6" fill="#160a1f"/>
    <circle cx="76" cy="61" r="2.6" fill="#160a1f"/>
    <circle cx="54" cy="58" r="1.8" fill="#fff"/>
    <circle cx="78" cy="58" r="1.8" fill="#fff"/>
    <circle cx="50" cy="64" r="1" fill="#fff" opacity="0.7"/>
    <circle cx="74" cy="64" r="1" fill="#fff" opacity="0.7"/>
  </g>

  <g class="face-part eyes-blink">
    <path d="M45 60 Q 52 65 59 60" fill="none" stroke="#0d0612" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M69 60 Q 76 65 83 60" fill="none" stroke="#0d0612" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-happy">
    <path d="M45 63 Q 52 53 59 63" fill="none" stroke="#0d0612" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 63 Q 76 53 83 63" fill="none" stroke="#0d0612" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-annoyed">
    <path d="M44 48 L 60 53" stroke="#0d0612" stroke-width="3" stroke-linecap="round"/>
    <path d="M84 48 L 68 53" stroke="#0d0612" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="52" cy="62" rx="7.5" ry="5" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="76" cy="62" rx="7.5" ry="5" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="52" cy="62" rx="4.5" ry="4" fill="#c81e3a"/>
    <ellipse cx="76" cy="62" rx="4.5" ry="4" fill="#c81e3a"/>
    <circle cx="52" cy="62" r="2" fill="#160a1f"/>
    <circle cx="76" cy="62" r="2" fill="#160a1f"/>
  </g>

  <g class="face-part eyes-wink">
    <ellipse cx="52" cy="60" rx="8" ry="9" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="5.5" ry="6.5" fill="#c81e3a"/>
    <circle cx="52" cy="61" r="2.6" fill="#160a1f"/>
    <circle cx="54" cy="58" r="1.8" fill="#fff"/>
    <path d="M69 62 Q 76 55 83 62" fill="none" stroke="#0d0612" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-love">
    <path d="M46 55 C 46 51, 52 51, 52 55 C 52 51, 58 51, 58 55 C 58 61, 52 67, 52 67 C 52 67, 46 61, 46 55 Z" fill="#ff2d4d" stroke="#0d0612" stroke-width="1.5"/>
    <path d="M70 55 C 70 51, 76 51, 76 55 C 76 51, 82 51, 82 55 C 82 61, 76 67, 76 67 C 76 67, 70 61, 70 55 Z" fill="#ff2d4d" stroke="#0d0612" stroke-width="1.5"/>
  </g>

  <g class="face-part eyes-shocked">
    <ellipse cx="52" cy="60" rx="9" ry="10" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="9" ry="10" fill="#fff" stroke="#0d0612" stroke-width="1.5"/>
    <circle cx="52" cy="61" r="3" fill="#c81e3a"/>
    <circle cx="76" cy="61" r="3" fill="#c81e3a"/>
    <circle cx="52" cy="61" r="1.5" fill="#160a1f"/>
    <circle cx="76" cy="61" r="1.5" fill="#160a1f"/>
  </g>

  <!-- MOUTHS -->
  <path class="face-part mouth-idle" d="M59 79 Q 64 83 69 79" fill="none" stroke="#0d0612" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-happy">
    <path d="M54 77 Q 64 89 74 77 Z" fill="#7a1020" stroke="#0d0612" stroke-width="2" stroke-linejoin="round"/>
    <path d="M57 78 L 60 78 L 58.5 82 Z" fill="#fff"/>
    <path d="M68 78 L 71 78 L 69.5 82 Z" fill="#fff"/>
    <ellipse cx="64" cy="85" rx="3.5" ry="2" fill="#e8879a"/>
  </g>
  <path class="face-part mouth-annoyed" d="M57 82 L 71 80" fill="none" stroke="#0d0612" stroke-width="2.5" stroke-linecap="round"/>
  <path class="face-part mouth-wink" d="M57 79 Q 64 84 72 76" fill="none" stroke="#0d0612" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-open">
    <ellipse cx="64" cy="81" rx="5" ry="6" fill="#7a1020" stroke="#0d0612" stroke-width="2"/>
  </g>
  <path class="face-part mouth-smirk" d="M57 80 Q 64 82 71 76" fill="none" stroke="#0d0612" stroke-width="2.5" stroke-linecap="round"/>

  <!-- fangs (always slightly visible) -->
  <path class="v-fang" d="M58 79 L 61 79 L 59.5 83 Z" fill="#fff" stroke="#0d0612" stroke-width="0.8"/>

  <!-- floating hearts on happy/love -->
  <g class="v-hearts">
    <path d="M100 34 C 100 30, 106 30, 106 34 C 106 30, 112 30, 112 34 C 112 40, 106 46, 106 46 C 106 46, 100 40, 100 34 Z" fill="#ff2d4d" opacity="0.9"/>
    <path d="M16 44 C 16 41, 20 41, 20 44 C 20 41, 24 41, 24 44 C 24 48, 20 52, 20 52 C 20 52, 16 48, 16 44 Z" fill="#ff6b85" opacity="0.75"/>
  </g>

  <!-- anger mark on annoyed -->
  <g class="v-anger">
    <path d="M96 30 L 106 30 M 101 25 L 101 35" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
    <path d="M97 26 L 105 34 M 105 26 L 97 34" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- sweat drop on shocked -->
  <path class="v-sweat" d="M96 44 C 96 40, 100 36, 100 36 C 100 36, 104 40, 104 44 C 104 47, 102 49, 100 49 C 98 49, 96 47, 96 44 Z" fill="#7fd4ff" stroke="#0d0612" stroke-width="1.2"/>
</svg>
`;

// Injects the mascot markup into every element with [data-mascot].
function mountMascots() {
  document.querySelectorAll("[data-mascot]").forEach((slot) => {
    if (slot.dataset.mounted === "1") return;
    slot.innerHTML = MASCOT_SVG;
    slot.dataset.mounted = "1";
  });
}

const MOODS = ["idle", "happy", "annoyed", "wink", "love", "shocked", "smug"];

// Sets mood on every mounted mascot (or just those inside `scopeEl`).
function setMascotMood(mood, scopeEl) {
  const root = scopeEl || document;
  root.querySelectorAll(".mascot-svg").forEach((svg) => {
    MOODS.forEach((m) => svg.classList.remove(`mood-${m}`));
    svg.classList.add(`mood-${mood}`);
  });
}

// One-shot reaction animation: bounce / shake / pop.
function mascotReact(animation, scopeEl) {
  const root = scopeEl || document;
  root.querySelectorAll(".mascot-wrap").forEach((wrap) => {
    wrap.classList.remove("react-bounce", "react-shake", "react-pop");
    void wrap.offsetWidth; // restart the CSS animation
    wrap.classList.add(`react-${animation}`);
    setTimeout(() => wrap.classList.remove(`react-${animation}`), 900);
  });
}
