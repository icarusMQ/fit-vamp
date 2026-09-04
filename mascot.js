/* Mascots — selectable SVGs reused wherever a [data-mascot] slot appears,
   with mood driven by a CSS class on the <svg> element. Every entry must
   reuse the same .mascot-svg, .face-part, mood-, eyes- and mouth- class
   contract (plus the optional .v-aura/.v-wing/.v-blush/.v-hearts/.v-anger/
   .v-sweat decoration classes styles.css already animates) so setMascotMood/
   mascotReact/setMascotFlagged keep working unchanged no matter which
   mascot is mounted. */

const MASCOT_VESPER_SVG = `
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

const MASCOT_GRIMBLE_SVG = `
<svg class="mascot-svg mood-idle" viewBox="0 0 128 148" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="grimGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#4caf3c" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#4caf3c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grimSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5a8a3c"/>
      <stop offset="100%" stop-color="#33531f"/>
    </linearGradient>
    <linearGradient id="grimBelly" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7fae54"/>
      <stop offset="100%" stop-color="#4a7530"/>
    </linearGradient>
    <linearGradient id="grimHorn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0a63a"/>
      <stop offset="100%" stop-color="#8a5a17"/>
    </linearGradient>
  </defs>

  <ellipse cx="64" cy="76" rx="58" ry="58" fill="url(#grimGlow)" class="v-aura"/>

  <!-- ears (static — Grimble is a ground-dweller, no wings) -->
  <path d="M28 60 L 6 44 L 26 76 Z" fill="url(#grimSkin)" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>
  <path d="M100 60 L 122 44 L 102 76 Z" fill="url(#grimSkin)" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>

  <!-- horns -->
  <path d="M46 30 L 40 8 L 52 26 Z" fill="url(#grimHorn)" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>
  <path d="M82 30 L 88 8 L 76 26 Z" fill="url(#grimHorn)" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>

  <!-- body -->
  <path class="v-body" d="M40 104 C 34 118, 32 132, 32 142 L 96 142 C 96 132, 94 118, 88 104 Z"
        fill="url(#grimSkin)" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="64" cy="122" rx="18" ry="16" fill="url(#grimBelly)"/>

  <!-- head -->
  <path d="M34 58 C 34 32, 46 24, 64 24 C 82 24, 94 32, 94 58
           C 94 82, 82 96, 64 96 C 46 96, 34 82, 34 58 Z"
        fill="url(#grimSkin)" stroke="#1c2e10" stroke-width="2"/>

  <!-- blush -->
  <ellipse class="v-blush" cx="46" cy="72" rx="6" ry="4" fill="#e8879a" opacity="0.55"/>
  <ellipse class="v-blush" cx="82" cy="72" rx="6" ry="4" fill="#e8879a" opacity="0.55"/>

  <!-- EYES -->
  <g class="face-part eyes-open">
    <ellipse cx="52" cy="60" rx="8" ry="9" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="8" ry="9" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="5" ry="6" fill="#e0781e"/>
    <ellipse cx="76" cy="61" rx="5" ry="6" fill="#e0781e"/>
    <circle cx="52" cy="61" r="2.4" fill="#1c2e10"/>
    <circle cx="76" cy="61" r="2.4" fill="#1c2e10"/>
    <circle cx="54" cy="58" r="1.6" fill="#fff"/>
    <circle cx="78" cy="58" r="1.6" fill="#fff"/>
  </g>

  <g class="face-part eyes-blink">
    <path d="M45 60 Q 52 65 59 60" fill="none" stroke="#1c2e10" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M69 60 Q 76 65 83 60" fill="none" stroke="#1c2e10" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-happy">
    <path d="M45 63 Q 52 53 59 63" fill="none" stroke="#1c2e10" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 63 Q 76 53 83 63" fill="none" stroke="#1c2e10" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-annoyed">
    <path d="M44 50 L 60 54" stroke="#1c2e10" stroke-width="3" stroke-linecap="round"/>
    <path d="M84 50 L 68 54" stroke="#1c2e10" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="52" cy="62" rx="7" ry="4.5" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="76" cy="62" rx="7" ry="4.5" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="52" cy="62" rx="4" ry="3.5" fill="#e0781e"/>
    <ellipse cx="76" cy="62" rx="4" ry="3.5" fill="#e0781e"/>
    <circle cx="52" cy="62" r="1.8" fill="#1c2e10"/>
    <circle cx="76" cy="62" r="1.8" fill="#1c2e10"/>
  </g>

  <g class="face-part eyes-wink">
    <ellipse cx="52" cy="60" rx="8" ry="9" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="5" ry="6" fill="#e0781e"/>
    <circle cx="52" cy="61" r="2.4" fill="#1c2e10"/>
    <circle cx="54" cy="58" r="1.6" fill="#fff"/>
    <path d="M69 62 Q 76 55 83 62" fill="none" stroke="#1c2e10" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-love">
    <path d="M46 55 C 46 51, 52 51, 52 55 C 52 51, 58 51, 58 55 C 58 61, 52 67, 52 67 C 52 67, 46 61, 46 55 Z" fill="#ff6b3d" stroke="#1c2e10" stroke-width="1.5"/>
    <path d="M70 55 C 70 51, 76 51, 76 55 C 76 51, 82 51, 82 55 C 82 61, 76 67, 76 67 C 76 67, 70 61, 70 55 Z" fill="#ff6b3d" stroke="#1c2e10" stroke-width="1.5"/>
  </g>

  <g class="face-part eyes-shocked">
    <ellipse cx="52" cy="60" rx="9" ry="10" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="9" ry="10" fill="#fff2d0" stroke="#1c2e10" stroke-width="1.5"/>
    <circle cx="52" cy="61" r="3" fill="#e0781e"/>
    <circle cx="76" cy="61" r="3" fill="#e0781e"/>
    <circle cx="52" cy="61" r="1.5" fill="#1c2e10"/>
    <circle cx="76" cy="61" r="1.5" fill="#1c2e10"/>
  </g>

  <!-- MOUTHS -->
  <path class="face-part mouth-idle" d="M56 80 Q 64 84 72 80" fill="none" stroke="#1c2e10" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-happy">
    <path d="M52 78 Q 64 92 76 78 Z" fill="#3a1006" stroke="#1c2e10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M56 79 L 60 79 L 58 84 Z" fill="#fff"/>
    <path d="M68 79 L 72 79 L 70 84 Z" fill="#fff"/>
  </g>
  <path class="face-part mouth-annoyed" d="M56 84 L 72 81" fill="none" stroke="#1c2e10" stroke-width="2.5" stroke-linecap="round"/>
  <path class="face-part mouth-wink" d="M56 80 Q 64 86 74 76" fill="none" stroke="#1c2e10" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-open">
    <ellipse cx="64" cy="82" rx="6" ry="7" fill="#3a1006" stroke="#1c2e10" stroke-width="2"/>
  </g>
  <path class="face-part mouth-smirk" d="M56 81 Q 64 84 74 76" fill="none" stroke="#1c2e10" stroke-width="2.5" stroke-linecap="round"/>

  <path class="v-fang" d="M60 80 L 63 80 L 61.5 85 Z" fill="#fff" stroke="#1c2e10" stroke-width="0.8"/>

  <g class="v-hearts">
    <path d="M100 34 C 100 30, 106 30, 106 34 C 106 30, 112 30, 112 34 C 112 40, 106 46, 106 46 C 106 46, 100 40, 100 34 Z" fill="#ff6b3d" opacity="0.9"/>
    <path d="M16 44 C 16 41, 20 41, 20 44 C 20 41, 24 41, 24 44 C 24 48, 20 52, 20 52 C 20 52, 16 48, 16 44 Z" fill="#ff9a6b" opacity="0.75"/>
  </g>

  <g class="v-anger">
    <path d="M96 30 L 106 30 M 101 25 L 101 35" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
    <path d="M97 26 L 105 34 M 105 26 L 97 34" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
  </g>

  <path class="v-sweat" d="M96 44 C 96 40, 100 36, 100 36 C 100 36, 104 40, 104 44 C 104 47, 102 49, 100 49 C 98 49, 96 47, 96 44 Z" fill="#7fd4ff" stroke="#1c2e10" stroke-width="1.2"/>
</svg>
`;

const MASCOT_WISP_SVG = `
<svg class="mascot-svg mood-idle" viewBox="0 0 128 148" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="wispGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#6ecbff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#6ecbff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wispBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eaf7ff"/>
      <stop offset="100%" stop-color="#a9d9f2"/>
    </linearGradient>
  </defs>

  <ellipse cx="64" cy="76" rx="58" ry="58" fill="url(#wispGlow)" class="v-aura"/>

  <!-- tapering ghost body — no wings, no legs, just a wavy hem -->
  <path class="v-body" d="M34 60 C 34 30, 46 18, 64 18 C 82 18, 94 30, 94 60
           L 94 118
           C 88 112, 84 124, 78 118 C 72 112, 68 124, 62 118
           C 56 112, 52 124, 46 118 C 40 112, 36 124, 34 118 Z"
        fill="url(#wispBody)" stroke="#3a6f8c" stroke-width="2" stroke-linejoin="round" opacity="0.92"/>

  <!-- blush -->
  <ellipse class="v-blush" cx="46" cy="66" rx="6" ry="4" fill="#8fd9ff" opacity="0.6"/>
  <ellipse class="v-blush" cx="82" cy="66" rx="6" ry="4" fill="#8fd9ff" opacity="0.6"/>

  <!-- EYES -->
  <g class="face-part eyes-open">
    <ellipse cx="52" cy="56" rx="7.5" ry="8.5" fill="#0d2233"/>
    <ellipse cx="76" cy="56" rx="7.5" ry="8.5" fill="#0d2233"/>
    <circle cx="54" cy="53" r="2" fill="#fff"/>
    <circle cx="78" cy="53" r="2" fill="#fff"/>
  </g>

  <g class="face-part eyes-blink">
    <path d="M45 56 Q 52 61 59 56" fill="none" stroke="#0d2233" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M69 56 Q 76 61 83 56" fill="none" stroke="#0d2233" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-happy">
    <path d="M45 59 Q 52 49 59 59" fill="none" stroke="#0d2233" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 59 Q 76 49 83 59" fill="none" stroke="#0d2233" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-annoyed">
    <path d="M44 44 L 60 48" stroke="#0d2233" stroke-width="3" stroke-linecap="round"/>
    <path d="M84 44 L 68 48" stroke="#0d2233" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="52" cy="58" rx="6.5" ry="4.5" fill="#0d2233"/>
    <ellipse cx="76" cy="58" rx="6.5" ry="4.5" fill="#0d2233"/>
  </g>

  <g class="face-part eyes-wink">
    <ellipse cx="52" cy="56" rx="7.5" ry="8.5" fill="#0d2233"/>
    <circle cx="54" cy="53" r="2" fill="#fff"/>
    <path d="M69 58 Q 76 51 83 58" fill="none" stroke="#0d2233" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-love">
    <path d="M46 51 C 46 47, 52 47, 52 51 C 52 47, 58 47, 58 51 C 58 57, 52 63, 52 63 C 52 63, 46 57, 46 51 Z" fill="#ff6ea3" stroke="#0d2233" stroke-width="1.2"/>
    <path d="M70 51 C 70 47, 76 47, 76 51 C 76 47, 82 47, 82 51 C 82 57, 76 63, 76 63 C 76 63, 70 57, 70 51 Z" fill="#ff6ea3" stroke="#0d2233" stroke-width="1.2"/>
  </g>

  <g class="face-part eyes-shocked">
    <ellipse cx="52" cy="56" rx="8.5" ry="9.5" fill="#0d2233"/>
    <ellipse cx="76" cy="56" rx="8.5" ry="9.5" fill="#0d2233"/>
    <circle cx="54" cy="53" r="2" fill="#fff"/>
    <circle cx="78" cy="53" r="2" fill="#fff"/>
  </g>

  <!-- MOUTHS -->
  <path class="face-part mouth-idle" d="M56 74 Q 64 78 72 74" fill="none" stroke="#0d2233" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-happy">
    <path d="M52 72 Q 64 86 76 72 Z" fill="#0d2233"/>
  </g>
  <path class="face-part mouth-annoyed" d="M56 78 L 72 75" fill="none" stroke="#0d2233" stroke-width="2.5" stroke-linecap="round"/>
  <path class="face-part mouth-wink" d="M56 74 Q 64 80 74 70" fill="none" stroke="#0d2233" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-open">
    <ellipse cx="64" cy="77" rx="5" ry="6" fill="#0d2233"/>
  </g>
  <path class="face-part mouth-smirk" d="M56 75 Q 64 78 74 70" fill="none" stroke="#0d2233" stroke-width="2.5" stroke-linecap="round"/>

  <g class="v-hearts">
    <path d="M100 34 C 100 30, 106 30, 106 34 C 106 30, 112 30, 112 34 C 112 40, 106 46, 106 46 C 106 46, 100 40, 100 34 Z" fill="#ff6ea3" opacity="0.9"/>
    <path d="M16 44 C 16 41, 20 41, 20 44 C 20 41, 24 41, 24 44 C 24 48, 20 52, 20 52 C 20 52, 16 48, 16 44 Z" fill="#ff9ec3" opacity="0.75"/>
  </g>

  <g class="v-anger">
    <path d="M96 30 L 106 30 M 101 25 L 101 35" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
    <path d="M97 26 L 105 34 M 105 26 L 97 34" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
  </g>

  <path class="v-sweat" d="M96 40 C 96 36, 100 32, 100 32 C 100 32, 104 36, 104 40 C 104 43, 102 45, 100 45 C 98 45, 96 43, 96 40 Z" fill="#c8ecff" stroke="#0d2233" stroke-width="1.2"/>
</svg>
`;

const MASCOT_BLAZE_SVG = `
<svg class="mascot-svg mood-idle" viewBox="0 0 128 148" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blazeGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#4a90c2" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#4a90c2" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="blazeFur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b7f94"/>
      <stop offset="100%" stop-color="#333f4c"/>
    </linearGradient>
    <linearGradient id="blazeHoodie" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2f3f52"/>
      <stop offset="100%" stop-color="#161f29"/>
    </linearGradient>
    <linearGradient id="blazeBelly" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#aebcc9"/>
      <stop offset="100%" stop-color="#7e8fa0"/>
    </linearGradient>
  </defs>

  <ellipse cx="64" cy="76" rx="58" ry="58" fill="url(#blazeGlow)" class="v-aura"/>

  <!-- ears: pointed cat ears -->
  <path d="M32 44 L 18 10 L 50 34 Z" fill="url(#blazeFur)" stroke="#0e141b" stroke-width="2" stroke-linejoin="round"/>
  <path d="M35 36 L 26 16 L 44 30 Z" fill="#1c2732" opacity="0.85"/>
  <path d="M96 44 L 110 10 L 78 34 Z" fill="url(#blazeFur)" stroke="#0e141b" stroke-width="2" stroke-linejoin="round"/>
  <path d="M93 36 L 102 16 L 84 30 Z" fill="#1c2732" opacity="0.85"/>

  <!-- hoodie body with popped collar -->
  <path class="v-body" d="M38 106 C 32 120, 30 132, 30 142 L 98 142 C 98 132, 96 120, 90 106 Z"
        fill="url(#blazeHoodie)" stroke="#0e141b" stroke-width="2" stroke-linejoin="round"/>
  <path d="M44 106 L 64 118 L 84 106 L 84 113 L 64 125 L 44 113 Z" fill="#3d5266"/>

  <!-- head -->
  <path d="M34 58 C 34 32, 46 24, 64 24 C 82 24, 94 32, 94 58
           C 94 82, 82 96, 64 96 C 46 96, 34 82, 34 58 Z"
        fill="url(#blazeFur)" stroke="#0e141b" stroke-width="2"/>
  <ellipse cx="64" cy="80" rx="16" ry="12" fill="url(#blazeBelly)"/>

  <!-- cheek fur tufts -->
  <path d="M32 66 L 22 70 L 32 74 Z" fill="url(#blazeFur)" stroke="#0e141b" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M96 66 L 106 70 L 96 74 Z" fill="url(#blazeFur)" stroke="#0e141b" stroke-width="1.5" stroke-linejoin="round"/>

  <!-- whiskers -->
  <g stroke="#0e141b" stroke-width="1.2" stroke-linecap="round" opacity="0.6">
    <path d="M30 72 L 10 68 M30 76 L 9 76 M30 80 L 10 84"/>
    <path d="M98 72 L 118 68 M98 76 L 119 76 M98 80 L 118 84"/>
  </g>

  <!-- blush -->
  <ellipse class="v-blush" cx="46" cy="74" rx="6" ry="4" fill="#e8879a" opacity="0.45"/>
  <ellipse class="v-blush" cx="82" cy="74" rx="6" ry="4" fill="#e8879a" opacity="0.45"/>

  <!-- EYES: cool half-lidded almond shape with slit pupils -->
  <g class="face-part eyes-open">
    <path d="M44 60 Q 52 55 60 60 Q 52 66 44 60 Z" fill="#e8c34a" stroke="#0e141b" stroke-width="1.5"/>
    <path d="M68 60 Q 76 55 84 60 Q 76 66 68 60 Z" fill="#e8c34a" stroke="#0e141b" stroke-width="1.5"/>
    <ellipse cx="52" cy="60" rx="1.6" ry="4.5" fill="#0e141b"/>
    <ellipse cx="76" cy="60" rx="1.6" ry="4.5" fill="#0e141b"/>
  </g>

  <g class="face-part eyes-blink">
    <path d="M44 60 Q 52 63 60 60" fill="none" stroke="#0e141b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M68 60 Q 76 63 84 60" fill="none" stroke="#0e141b" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-happy">
    <path d="M44 62 Q 52 54 60 62" fill="none" stroke="#0e141b" stroke-width="3" stroke-linecap="round"/>
    <path d="M68 62 Q 76 54 84 62" fill="none" stroke="#0e141b" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-annoyed">
    <path d="M43 52 L 60 56" stroke="#0e141b" stroke-width="3" stroke-linecap="round"/>
    <path d="M85 52 L 68 56" stroke="#0e141b" stroke-width="3" stroke-linecap="round"/>
    <path d="M44 61 Q 52 58 60 61 Q 52 64 44 61 Z" fill="#e8c34a" stroke="#0e141b" stroke-width="1.5"/>
    <path d="M68 61 Q 76 58 84 61 Q 76 64 68 61 Z" fill="#e8c34a" stroke="#0e141b" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="1.4" ry="2.6" fill="#0e141b"/>
    <ellipse cx="76" cy="61" rx="1.4" ry="2.6" fill="#0e141b"/>
  </g>

  <g class="face-part eyes-wink">
    <path d="M44 60 Q 52 55 60 60 Q 52 66 44 60 Z" fill="#e8c34a" stroke="#0e141b" stroke-width="1.5"/>
    <ellipse cx="52" cy="60" rx="1.6" ry="4.5" fill="#0e141b"/>
    <path d="M68 62 Q 76 56 84 62" fill="none" stroke="#0e141b" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-love">
    <path d="M46 55 C 46 51, 52 51, 52 55 C 52 51, 58 51, 58 55 C 58 61, 52 67, 52 67 C 52 67, 46 61, 46 55 Z" fill="#5ec2ff" stroke="#0e141b" stroke-width="1.5"/>
    <path d="M70 55 C 70 51, 76 51, 76 55 C 76 51, 82 51, 82 55 C 82 61, 76 67, 76 67 C 76 67, 70 61, 70 55 Z" fill="#5ec2ff" stroke="#0e141b" stroke-width="1.5"/>
  </g>

  <g class="face-part eyes-shocked">
    <ellipse cx="52" cy="60" rx="9" ry="10" fill="#fff" stroke="#0e141b" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="9" ry="10" fill="#fff" stroke="#0e141b" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="2" ry="4" fill="#0e141b"/>
    <ellipse cx="76" cy="61" rx="2" ry="4" fill="#0e141b"/>
  </g>

  <!-- MOUTHS -->
  <path class="face-part mouth-idle" d="M58 82 Q 64 84 70 82" fill="none" stroke="#0e141b" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-happy">
    <path d="M54 80 Q 64 92 74 80 Z" fill="#5a1616" stroke="#0e141b" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <path class="face-part mouth-annoyed" d="M57 85 L 71 83" fill="none" stroke="#0e141b" stroke-width="2.5" stroke-linecap="round"/>
  <path class="face-part mouth-wink" d="M57 82 Q 64 87 73 79" fill="none" stroke="#0e141b" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-open">
    <ellipse cx="64" cy="84" rx="5" ry="6" fill="#5a1616" stroke="#0e141b" stroke-width="2"/>
  </g>
  <path class="face-part mouth-smirk" d="M57 83 Q 64 85 73 78" fill="none" stroke="#0e141b" stroke-width="2.5" stroke-linecap="round"/>

  <!-- toothpick — a boyish/cool-guy touch instead of a literal cigarette -->
  <path class="v-toothpick" d="M69 82 L 88 74" stroke="#e8c98a" stroke-width="2" stroke-linecap="round"/>

  <g class="v-hearts">
    <path d="M100 34 C 100 30, 106 30, 106 34 C 106 30, 112 30, 112 34 C 112 40, 106 46, 106 46 C 106 46, 100 40, 100 34 Z" fill="#5ec2ff" opacity="0.9"/>
    <path d="M16 44 C 16 41, 20 41, 20 44 C 20 41, 24 41, 24 44 C 24 48, 20 52, 20 52 C 20 52, 16 48, 16 44 Z" fill="#8fd8ff" opacity="0.75"/>
  </g>

  <g class="v-anger">
    <path d="M96 30 L 106 30 M 101 25 L 101 35" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
    <path d="M97 26 L 105 34 M 105 26 L 97 34" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
  </g>

  <path class="v-sweat" d="M96 44 C 96 40, 100 36, 100 36 C 100 36, 104 40, 104 44 C 104 47, 102 49, 100 49 C 98 49, 96 47, 96 44 Z" fill="#7fd4ff" stroke="#0e141b" stroke-width="1.2"/>
</svg>
`;

const MASCOT_MOCHI_SVG = `
<svg class="mascot-svg mood-idle" viewBox="0 0 128 148" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="mochiGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#ff8fc0" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#ff8fc0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mochiFur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffd9e6"/>
      <stop offset="100%" stop-color="#f2a9c4"/>
    </linearGradient>
    <linearGradient id="mochiDress" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff9ec3"/>
      <stop offset="100%" stop-color="#e05b8a"/>
    </linearGradient>
    <linearGradient id="mochiBow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff5c93"/>
      <stop offset="100%" stop-color="#d43c72"/>
    </linearGradient>
  </defs>

  <ellipse cx="64" cy="76" rx="58" ry="58" fill="url(#mochiGlow)" class="v-aura"/>

  <!-- ears: soft rounded-tip cat ears -->
  <path d="M32 46 C 22 26, 26 14, 34 12 C 38 24, 40 34, 44 42 Z" fill="url(#mochiFur)" stroke="#7a2f4a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M34 38 C 30 28, 31 20, 35 17 C 37 24, 38 31, 40 36 Z" fill="#ffd0e0" opacity="0.85"/>
  <path d="M96 46 C 106 26, 102 14, 94 12 C 90 24, 88 34, 84 42 Z" fill="url(#mochiFur)" stroke="#7a2f4a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M94 38 C 98 28, 97 20, 93 17 C 91 24, 90 31, 88 36 Z" fill="#ffd0e0" opacity="0.85"/>

  <!-- bow between ears -->
  <path d="M52 18 C 46 12, 38 14, 40 22 C 44 20, 48 20, 52 22 Z" fill="url(#mochiBow)" stroke="#7a2f4a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M76 18 C 82 12, 90 14, 88 22 C 84 20, 80 20, 76 22 Z" fill="url(#mochiBow)" stroke="#7a2f4a" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="64" cy="20" r="4" fill="#ff5c93" stroke="#7a2f4a" stroke-width="1.5"/>

  <!-- dress body -->
  <path class="v-body" d="M40 106 C 32 120, 30 134, 30 142 L 98 142 C 98 134, 96 120, 88 106 Z"
        fill="url(#mochiDress)" stroke="#7a2f4a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M56 116 C 56 112, 60 110, 64 114 C 68 110, 72 112, 72 116 C 72 120, 64 126, 64 126 C 64 126, 56 120, 56 116 Z" fill="#fff0f5"/>

  <!-- head -->
  <path d="M34 58 C 34 32, 46 24, 64 24 C 82 24, 94 32, 94 58
           C 94 82, 82 96, 64 96 C 46 96, 34 82, 34 58 Z"
        fill="url(#mochiFur)" stroke="#7a2f4a" stroke-width="2"/>

  <!-- whiskers -->
  <g stroke="#c76a8c" stroke-width="1.2" stroke-linecap="round" opacity="0.7">
    <path d="M32 72 L 12 69 M32 76 L 11 76 M32 80 L 12 85"/>
    <path d="M96 72 L 116 69 M96 76 L 117 76 M96 80 L 116 85"/>
  </g>

  <!-- blush -->
  <ellipse class="v-blush" cx="46" cy="72" rx="7.5" ry="5" fill="#ff6f9c" opacity="0.65"/>
  <ellipse class="v-blush" cx="82" cy="72" rx="7.5" ry="5" fill="#ff6f9c" opacity="0.65"/>

  <!-- EYES: big sparkly round eyes -->
  <g class="face-part eyes-open">
    <ellipse cx="52" cy="60" rx="9" ry="10" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="9" ry="10" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="6" ry="7" fill="#c66bd6"/>
    <ellipse cx="76" cy="61" rx="6" ry="7" fill="#c66bd6"/>
    <circle cx="52" cy="61" r="2.8" fill="#3a1030"/>
    <circle cx="76" cy="61" r="2.8" fill="#3a1030"/>
    <circle cx="55" cy="57" r="2.2" fill="#fff"/>
    <circle cx="79" cy="57" r="2.2" fill="#fff"/>
    <circle cx="49" cy="64" r="1.2" fill="#fff" opacity="0.8"/>
    <circle cx="73" cy="64" r="1.2" fill="#fff" opacity="0.8"/>
  </g>

  <g class="face-part eyes-blink">
    <path d="M44 60 Q 52 65 60 60" fill="none" stroke="#7a2f4a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M68 60 Q 76 65 84 60" fill="none" stroke="#7a2f4a" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-happy">
    <path d="M44 63 Q 52 53 60 63" fill="none" stroke="#7a2f4a" stroke-width="3" stroke-linecap="round"/>
    <path d="M68 63 Q 76 53 84 63" fill="none" stroke="#7a2f4a" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-annoyed">
    <path d="M44 50 L 60 54" stroke="#7a2f4a" stroke-width="3" stroke-linecap="round"/>
    <path d="M84 50 L 68 54" stroke="#7a2f4a" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="52" cy="62" rx="7.5" ry="5" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="76" cy="62" rx="7.5" ry="5" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="52" cy="62" rx="4.5" ry="4" fill="#c66bd6"/>
    <ellipse cx="76" cy="62" rx="4.5" ry="4" fill="#c66bd6"/>
    <circle cx="52" cy="62" r="2" fill="#3a1030"/>
    <circle cx="76" cy="62" r="2" fill="#3a1030"/>
  </g>

  <g class="face-part eyes-wink">
    <ellipse cx="52" cy="60" rx="9" ry="10" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="52" cy="61" rx="6" ry="7" fill="#c66bd6"/>
    <circle cx="52" cy="61" r="2.8" fill="#3a1030"/>
    <circle cx="55" cy="57" r="2.2" fill="#fff"/>
    <path d="M69 62 Q 76 55 83 62" fill="none" stroke="#7a2f4a" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g class="face-part eyes-love">
    <path d="M46 55 C 46 51, 52 51, 52 55 C 52 51, 58 51, 58 55 C 58 61, 52 67, 52 67 C 52 67, 46 61, 46 55 Z" fill="#ff4d82" stroke="#7a2f4a" stroke-width="1.5"/>
    <path d="M70 55 C 70 51, 76 51, 76 55 C 76 51, 82 51, 82 55 C 82 61, 76 67, 76 67 C 76 67, 70 61, 70 55 Z" fill="#ff4d82" stroke="#7a2f4a" stroke-width="1.5"/>
  </g>

  <g class="face-part eyes-shocked">
    <ellipse cx="52" cy="60" rx="10" ry="11" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <ellipse cx="76" cy="60" rx="10" ry="11" fill="#fff" stroke="#7a2f4a" stroke-width="1.5"/>
    <circle cx="52" cy="61" r="3.4" fill="#c66bd6"/>
    <circle cx="76" cy="61" r="3.4" fill="#c66bd6"/>
    <circle cx="52" cy="61" r="1.6" fill="#3a1030"/>
    <circle cx="76" cy="61" r="1.6" fill="#3a1030"/>
  </g>

  <!-- MOUTHS: small kitten mouth -->
  <path class="face-part mouth-idle" d="M58 81 Q 61 84 64 81 Q 67 84 70 81" fill="none" stroke="#7a2f4a" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-happy">
    <path d="M54 79 Q 64 91 74 79 Z" fill="#c23361" stroke="#7a2f4a" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="64" cy="86" rx="3" ry="1.8" fill="#ff9ec3"/>
  </g>
  <path class="face-part mouth-annoyed" d="M58 85 L 70 83" fill="none" stroke="#7a2f4a" stroke-width="2.5" stroke-linecap="round"/>
  <path class="face-part mouth-wink" d="M58 81 Q 64 86 72 78" fill="none" stroke="#7a2f4a" stroke-width="2" stroke-linecap="round"/>
  <g class="face-part mouth-open">
    <ellipse cx="64" cy="83" rx="5" ry="6" fill="#c23361" stroke="#7a2f4a" stroke-width="2"/>
  </g>
  <path class="face-part mouth-smirk" d="M58 82 Q 64 85 72 77" fill="none" stroke="#7a2f4a" stroke-width="2.5" stroke-linecap="round"/>

  <g class="v-hearts">
    <path d="M100 34 C 100 30, 106 30, 106 34 C 106 30, 112 30, 112 34 C 112 40, 106 46, 106 46 C 106 46, 100 40, 100 34 Z" fill="#ff4d82" opacity="0.9"/>
    <path d="M16 44 C 16 41, 20 41, 20 44 C 20 41, 24 41, 24 44 C 24 48, 20 52, 20 52 C 20 52, 16 48, 16 44 Z" fill="#ff8fb3" opacity="0.75"/>
  </g>

  <g class="v-anger">
    <path d="M96 30 L 106 30 M 101 25 L 101 35" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
    <path d="M97 26 L 105 34 M 105 26 L 97 34" stroke="#ff2d4d" stroke-width="3" stroke-linecap="round"/>
  </g>

  <path class="v-sweat" d="M96 44 C 96 40, 100 36, 100 36 C 100 36, 104 40, 104 44 C 104 47, 102 49, 100 49 C 98 49, 96 47, 96 44 Z" fill="#7fd4ff" stroke="#7a2f4a" stroke-width="1.2"/>
</svg>
`;

const MASCOTS = {
  vesper: { name: "Vesper", svg: MASCOT_VESPER_SVG },
  grimble: { name: "Grimble", svg: MASCOT_GRIMBLE_SVG },
  wisp: { name: "Wisp", svg: MASCOT_WISP_SVG },
  blaze: { name: "Blaze", svg: MASCOT_BLAZE_SVG },
  mochi: { name: "Mochi", svg: MASCOT_MOCHI_SVG },
};

const MASCOT_LS_KEY = "ft_mascot";

function getMascotId() {
  try {
    const id = localStorage.getItem(MASCOT_LS_KEY);
    return MASCOTS[id] ? id : "vesper";
  } catch {
    return "vesper";
  }
}

function setMascotId(id) {
  if (!MASCOTS[id]) return;
  try { localStorage.setItem(MASCOT_LS_KEY, id); } catch {}
  // Force every already-mounted slot to re-render with the new SVG.
  document.querySelectorAll("[data-mascot]").forEach((slot) => { slot.dataset.mounted = ""; });
  mountMascots();
}

// Injects the selected mascot's markup into every element with [data-mascot].
// Each slot also gets a mascot-<id> class (styles.css keys the idle "bob" and
// react-bounce/shake/pop animations off it) so every mascot has its own vibe
// without app.js's mascotReact() call sites needing to know which is active.
function mountMascots() {
  const id = getMascotId();
  const svg = MASCOTS[id].svg;
  document.querySelectorAll("[data-mascot]").forEach((slot) => {
    if (slot.dataset.mounted === "1") return;
    slot.innerHTML = svg;
    slot.dataset.mounted = "1";
    Object.keys(MASCOTS).forEach((k) => slot.classList.remove(`mascot-${k}`));
    slot.classList.add(`mascot-${id}`);
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

// Red Flag Court consequence (moderation.js) — an independent overlay on
// top of whatever mood is currently set, not part of the MOODS rotation,
// so it doesn't fight with the app's normal happy/annoyed/etc. logic.
function setMascotFlagged(flagged) {
  document.querySelectorAll(".mascot-svg").forEach((svg) => svg.classList.toggle("mascot-flagged", flagged));
}
