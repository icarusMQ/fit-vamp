# FitTrack

A personal fitness tracker PWA — plans/splits, guided workout sessions, weight
tracking, and light gamification (streaks, XP/levels, achievements). Built as
a single-user, fully offline app: everything is stored locally in the
browser's IndexedDB and localStorage. No backend, no API, no account, no data
ever leaves the device.

Inspired by [wger](https://github.com/wger-project/wger)'s feature set
(exercise database, workout plans, logging) but rebuilt from scratch as a
static, installable web app so it can run entirely on an iPhone via
"Add to Home Screen," with no server to host or maintain.

## Features

- **Plans & splits** — build multi-day routines (e.g. Push/Pull/Legs, A/B/C),
  each with its own exercise list and target sets/reps.
- **Guided sessions** — start a split and log one set per screen, with swipe
  navigation, a built-in rest timer, and a "last time" history panel with a
  copy button to reuse previous numbers.
- **Cardio support** — exercises can be tagged strength (reps/weight) or
  cardio (time/distance), with an optional stopwatch.
- **Bodyweight sets** — log reps at bodyweight, optionally plus added weight.
- **Weight tracking** — quick log, trend chart, lifetime stats.
- **Calendar** — see which days you trained or weighed in.
- **Gamification** — streaks, XP/levels, 100+ achievements, a mascot with
  contextual reactions, and synthesized sound effects (Web Audio, no audio
  files).
- **Offline-first PWA** — a service worker caches the whole app after first
  load; a 10-log-per-exercise retention limit keeps local storage small.

## Tech

Vanilla HTML/CSS/JS, no build step, no dependencies. Data lives in:

- `IndexedDB` — exercises, workout logs, weight logs, plans
- `localStorage` — achievements unlocked, personal records, streak/XP inputs,
  UI preferences (mute, last-used plan)

## Running it locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly (`file://`) also works for everything except
the service worker and "Add to Home Screen" install, which require serving
over `http://localhost` or real `https://`.

## Deploying (so you can install it on an iPhone)

The service worker and install prompt need a real HTTPS origin. Easiest free
options:

- **[Netlify Drop](https://app.netlify.com/drop)** — drag this folder in, get
  an instant HTTPS URL. No account needed for a one-off deploy; sign up (free)
  to keep the same URL long-term.
- **GitHub Pages** — push this repo, enable Pages in Settings → Pages, source
  = root of `main`.

Then on your iPhone: open the URL in Safari → Share → **Add to Home Screen**.
It launches full-screen and works offline after the first load.

## Project structure

```
index.html            App shell + all markup (tabs, modals, session player)
styles.css             All styling (dark gothic/pixel theme, animations)
app.js                 App logic: IndexedDB, sessions, stats, achievements
exercises-data.js      Seed exercise list (curated, CC BY-SA 3.0 inspired by wger)
achievements-data.js   Achievement definitions
mascot.js               Mascot SVG + mood/animation helpers
dialogue.js             Mascot dialogue lines
sounds.js               Web Audio sound effects
manifest.json           PWA manifest
sw.js                   Service worker (offline caching)
icons/                  App icons
```

## Data & privacy

Nothing is transmitted anywhere. The only network requests the app makes are
loading its own static files and the two Google Fonts (`Press Start 2P`,
`VT323`) on first load, which the service worker then caches for offline use.
Uninstalling the app / clearing site data deletes everything.

## License

Personal project — no license file included, use as you like. Exercise
naming/categorization is inspired by wger's open exercise database
(CC BY-SA 3.0, see [wger-project/wger](https://github.com/wger-project/wger)).
