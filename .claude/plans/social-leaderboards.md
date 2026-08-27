# Social Leaderboards — Implementation Plan

Status: all 9 build-order steps implemented and tested (2026-08-20/21) — see
each step's ✅ notes below for exactly what was verified and, for the AWS/
Google pieces, what remains untested against real infrastructure. Not yet
done: an actual multi-device test on real phones, and a real AWS/Google
smoke test (see "Open questions").

## Goal

Add friend-vs-friend leaderboards to FitTrack (currently a fully local,
no-network PWA — see `app.js` line 1 and `sw.js` line 3, both of which will
need their "nothing is ever sent anywhere" claims corrected once this ships)
without turning the AWS server into a database. The server relays end-to-end
encrypted events between devices and keeps nothing durable — closer to
WhatsApp's model than to a typical backend. Every device remains the source
of truth for its own data; leaderboards and moderation state are computed
locally from a cached, merged event log.

## Decisions locked in during design discussion

- **Pairing**: QR code encodes a public key (+ display name). Scanning
  establishes a friend link. No signaling server needed for this step.
- **Transport**: WebSocket relay on the existing AWS box. Server holds
  undelivered messages **in memory only**, with a TTL (a few days), and
  deletes on delivery or expiry. Nothing touches disk (one deliberate
  exception for court videos — see Red Flag Court, below).
- **Groups**: two types, chosen at group-creation time.
  - **Bounded** — QR invite adds the scanner to that one group and links
    them only to that group's existing members. Never affects other groups.
  - **Snowball** — QR invite does the same, but also unions the scanner's
    other snowball-group rosters with this group's roster, recursively.
    Bounded groups never participate in a snowball merge.
- **Dedup**: friendship is pairwise and shared across groups — one relay
  mailbox and one cached event stream per friend pubkey, regardless of how
  many groups you share with them.
- **Home page**: rolled-up "resume" of the user's placement across every
  group they belong to, now extended to surface *dynamic best-fit*
  leaderboards (see Drops section).
- **Identity recovery**: username + persistent user ID, plus optional backup
  (local encrypted file or Google Drive `appdata`) that restores identity,
  workouts, friends, and groups on a new device.
- **Scoring**: a single unified point currency, **Drops**, computed with
  physics-based formulas from weight/reps/distance/time/bodyweight, sliced
  into many dynamic leaderboard views (exercise, cardio, consistency, unisex,
  gender, height bracket, level bracket).
- **Group/friend removal**: propagated as a signed "revoke" message queued
  on the relay like any other event, so offline members eventually receive
  and apply it.
- **Moderation**: peer-driven Red Flag system with a report threshold, a
  video-evidence appeal ("court"), community voting, and escalating
  consequences up to a 3-strike lockout (self-data-deletion always exempt).

## Critical existing-code issue to fix first

`app.js`'s `workoutLogs` store keys `exerciseId` off IndexedDB's
autoincrement `exercises.id` (`app.js:17`, `app.js:24-28`), and exercises are
freely user-editable/addable (`exercises-data.js:5`). **That ID is not
comparable across devices.** Two users' "Barbell Bench Press" will have
different local ids.

Fix: add two fields to each exercise record, computed once at seed time for
`SEED_EXERCISES` and on creation for user-added exercises:
- `canonicalId` — a slug derived from the normalized name (e.g.
  `barbell-bench-press`). Leaderboard events reference this, never the local
  autoincrement id. Custom exercises a user invents won't match anyone
  else's — that's correct, not a bug.
- `romMeters` — an estimated range-of-motion in meters, used by the Drops
  formula (see below). Needs a seed table for `SEED_EXERCISES`
  (approximate, tunable) and a sane default (e.g. 0.4m) plus an editable
  field for user-added exercises so Drops still compute for custom lifts.

## New IndexedDB stores (bump `DB_VERSION` in `app.js:5`)

```
identity          { id:1 (singleton), publicKeyJwk, privateKeyJwk, deviceId,
                     username, userTag (short random suffix, e.g. "a1b2"),
                     genderSelf?: "M"|"F"|undisclosed, heightCm?, bodyweightKg? }
friends           { pubkey (keyPath), displayName, username, userTag, addedAt,
                     genderSelf?, heightCm?, bodyweightKg?, lastSeenEventTs }
groups            { id (keyPath, uuid), name, type: "bounded"|"snowball",
                     memberPubkeys: [...], rosterVersion, createdAt }
leaderboardEvents { id (keyPath, "<pubkey>:<eventId>"), authorPubkey,
                     type: "set"|"checkin", canonicalExerciseId?, weight?,
                     reps?, bw?, distanceKm?, durationSec?, date, sessionId,
                     ts, sig }
outbox            { id (keyPath, autoIncrement), toPubkeys: [...], payload, createdAt }
reports           { id (keyPath, "<targetPubkey>:<reporterPubkey>:<groupId>"),
                     targetPubkey, groupId, reporterPubkey, reason, ts, sig }
courtVideos       { id (keyPath), targetPubkey, groupId, videoRef (S3 key),
                     submittedAt, expiresAt }
courtVotes        { id (keyPath, "<targetPubkey>:<groupId>:<voterPubkey>"),
                     targetPubkey, groupId, voterPubkey, vote: "clear"|"uphold", ts, sig }
flagHistory       { id (keyPath, autoIncrement), targetPubkey, groupId,
                     outcome: "upheld"|"cleared", resolvedAt }
```

`leaderboardEvents` also stores the local user's own events (authorPubkey =
own pubkey) so aggregation reads one uniform source — no special-casing
"me vs. friends."

## Identity, crypto & backup/recovery

- On first launch: generate a keypair (WebCrypto), a `userTag` (random
  4-char suffix), and prompt for a `username`. Public identity = `username#tag`
  + pubkey — this is display-only, not globally enforced-unique (there's no
  registry to enforce it against), but collisions become vanishingly rare
  with the tag suffix, same pattern as old Discord/Battle.net handles.
- **Local backup**: "Export backup" bundles `identity` + all data stores
  into one JSON blob, encrypted with a user-chosen passphrase (PBKDF2 →
  AES-GCM), saved via the browser's file-save flow. "Restore backup" reverses
  this on a fresh install — same identity, same pubkey, friends never notice
  a change.
- **Google Drive backup**: OAuth (PKCE, public client id — no backend secret
  needed, works from a static PWA) against the `drive.appdata` scope (a
  hidden per-app folder Drive gives each app; nothing else in the user's
  Drive is touched). Same encrypted blob as the local backup, just synced
  automatically. This is the WhatsApp analogy made literal — WhatsApp's own
  backup story is "Google Drive holds an encrypted copy, our servers don't."
- No backup taken → reinstall is a new identity, friends must re-pair. That
  remains the default/free-tier behavior; backup is opt-in.

## Relay server (AWS)

Plain WebSocket server (Node + `ws`, or API Gateway WebSocket + Lambda if you
want it serverless-serverless). No database, with one narrow exception below.

- On connect, client authenticates by signing a server-issued nonce with its
  private key → server maps `pubkey -> connectionId` in memory.
- `send` message: `{ to: pubkey, payload: <encrypted blob> }`. If `to` is
  connected, forward immediately. If not, hold in an in-memory `Map<pubkey,
  Array<{payload, expiresAt}>>` with a TTL (e.g. 3 days); flush to the client
  on next connect; drop silently past TTL.
- Message `type`s riding inside the encrypted payload: `workout-event`,
  `profile-update`, `group-roster`, `revoke`, `report`, `court-vote`. All
  signed by the author; recipients verify before applying.
- **Court video exception**: video evidence is too large for the in-memory
  relay queue. Store court videos in S3 with a bucket lifecycle rule that
  hard-deletes objects after the court window closes (e.g. 14 days) — an
  explicit, time-boxed exception to "server stores nothing," scoped only to
  active moderation disputes, not user data in general. Flag this to the
  user as a deliberate trade-off, not an oversight.
- Rate-limit per pubkey on `send` to blunt abuse/spam.

## Group merge algorithm (snowball)

Represent snowball membership as union-find over pubkeys, computed locally
on each device from the set of snowball groups it knows about:

1. When you scan a snowball-group QR, you receive (via relay, from the
   inviter) that group's full current roster.
2. Add yourself to the roster; for every *other* snowball group any of
   those members also belong to (learned via their own broadcasts), union
   your membership into that group's roster too — recursively, bounded by
   groups you've actually been introduced to.
3. Broadcast the updated roster (with a bumped `rosterVersion`) to all
   affected members so local state converges. Tie-break conflicting
   concurrent merges by highest `rosterVersion`, ties broken by
   lexicographically smaller group id.
4. Bounded groups are excluded from step 2 entirely.

## Drops — the point system

One unified currency, computed client-side, physics-grounded so it's
explainable rather than arbitrary. These are deliberately simplified physics
(not biomechanically exact) — good enough to be fun and hard to game by
accident, not meant to survive a physics PhD's scrutiny. Constants below are
starting points; expect a calibration pass once real usage data exists.

**Strength & bodyweight sets** (work-energy formula):
```
mass_kg   = weight + (bw ? bodyweightKg : 0)
work_J    = mass_kg * 9.81 * romMeters(exercise) * reps
drops     = work_J / STRENGTH_DROPS_DIVISOR   // 50
```
Bodyweight-only exercises (push-ups, dips, pull-ups) use the same formula
with `mass_kg = bodyweightKg (+ any added weight)` — no special-casing
needed, the existing `s.bw`/`s.weight` fields in `app.js`'s set model
(`formatSet`, `app.js:114-123`) already carry this.

**Cardio** (metabolic-cost approximation — the standard exercise-science
estimate that horizontal locomotion costs ≈1 kcal/kg/km):
```
energy_J  = bodyweightKg * distanceKm * 4184
pace_kmh  = distanceKm / durationHours
intensity = clamp(pace_kmh / 8, 0.7, 2.0)   // 8km/h jog = baseline
drops     = (energy_J / CARDIO_DROPS_DIVISOR) * intensity   // 1000, not 50
```
Distance-less holds (planks, ...) have no pace signal, so they fall back to
`drops = (bodyweightKg * durationHours * 3 * 4184) / CARDIO_DROPS_DIVISOR` — a
flat isometric metabolic-rate estimate, rougher than the distance-based
formula above.

**Why two divisors, not one:** strength and cardio start from physically
different quantities — mechanical work per *set* vs. total metabolic energy
per *session* — and they land in wildly different Joule magnitudes for an
equally hard effort. Built and checked with concrete numbers during
implementation: a heavy 8-rep bench set is ~3.5kJ of mechanical work; a
moderate 5km run is ~1,460kJ of metabolic energy — about 400x apart. A single
shared divisor (as originally sketched here) made every cardio session worth
roughly 500x a strength set, which would have made the exercise and total
Drops boards meaningless for anyone who both lifts and runs. `STRENGTH_DROPS_DIVISOR
= 50` keeps one hard set around 50-100 Drops; `CARDIO_DROPS_DIVISOR = 1000`
keeps one solid session in roughly the same few-hundred-to-low-thousands
range as a full multi-exercise strength session's running total. Still an
approximation worth revisiting once real usage data exists, but not the
~400x-off version.

**Consistency**: gym-visit count (distinct `(pubkey, date)` check-ins),
already in the original plan — unchanged.

### Leaderboard dimensions

Every leaderboard is `computeLeaderboard(events, filters)` over the same
cached event log — dimensions compose as filters, not separate pipelines:

- **Scope**: a group (bounded or snowball) the user belongs to.
- **Metric**: per-exercise max-weight, per-exercise cumulative Drops
  (rewards consistency, not just a single PR), cardio Drops, total Drops
  (everything combined), gym-visit count.
- **Window**: calendar month, or the 5-month cycle anchored to a fixed
  epoch (unchanged from original plan).
- **Demographic slice**: unisex (default, everyone), gender (from
  `genderSelf`, self-reported and optional — anyone who leaves it unset only
  ever appears in unisex boards), height bracket (configurable buckets,
  e.g. <165/165–175/175–185/185+ cm), level bracket (tier derived from
  lifetime cumulative Drops, thresholds TBD — reuse the tiering spirit of
  `achievements-data.js` rather than inventing a parallel system).

### Dynamic "best fit" home page

Home page resume computes the user's rank across every leaderboard variant
they qualify for (every metric × window × demographic slice, across every
group they're in), and surfaces the ones where they place best — e.g. "#1
Bench Press, Leg Day Crew, this month" or "#2 Consistency, unisex, 5-month" —
rather than one fixed board. Pure client-side ranking over already-cached
data; no new sync needed beyond what's already required for the boards
themselves.

## Sync flow

1. User logs a set / checks in → event appended to local `leaderboardEvents`
   → enqueued in `outbox` addressed to every friend across all groups
   (deduped to one outbox entry per unique friend).
2. Profile changes (bodyweight, height, gender) broadcast as a
   `profile-update` event the same way, so friends' cached Drops
   recompute correctly without re-deriving anything from raw weight.
3. When online, flush `outbox`: encrypt+send, delete on relay ack.
4. Incoming messages: verify signature, upsert (idempotent via
   `<pubkey>:<eventId>` keys), re-render visible boards.
5. Reconnect: exponential-backoff WebSocket client; relay auto-flushes
   anything it queued for you, then the client flushes its own outbox.

## Leaving a group / revoking a friend

A `revoke` event (`{ type: "revoke", scope: "group"|"friend", groupId?,
targetPubkey, actorPubkey, sig }`) is addressed to every member of the
affected group(s) and queued on the relay exactly like a workout event —
reuses the existing in-memory TTL queue, no new server mechanism. Offline
members receive it on next connect and locally purge the target's cached
events/roster entry. Self-revoke (leaving a group) and moderation-driven
removal (see below) both use this same message.

## Red Flag Court

Fully event-sourced, same pattern as everything else — flag state is
*derived* locally from cached signed reports, never declared by a central
authority.

- **Report**: any group member can submit `{ type: "report", targetPubkey,
  groupId, reason }`, signed, relayed to the rest of the group.
- **Threshold**: a target becomes **flagged** in a group once distinct
  reporters reach `min(ceil(0.10 * groupSize), 10)` — i.e. 10% of the group,
  capped so it never requires more than 10 people even in huge groups, and
  never demands more reporters than the group actually has in small ones.
- **Court (appeal)**: once flagged, the target has a fixed window (proposed:
  14 days) to record and submit a defense video. Submission uploads to the
  S3 exception described above and notifies the group. Members vote
  `clear` or `uphold`; simple majority of votes cast within the window
  decides. No video submitted, or window closes with no quorum → flag is
  auto-upheld.
- **Consequences while flagged**:
  - Mascot (`mascot.js`) enters a "turned away" pose state.
  - Sound effects (`sounds.js`) swap to a fart-sound set.
  - Displayed/counted Drops for that user are multiplied by 0.2 in every
    leaderboard (raw historical events are untouched, so a cleared flag
    fully restores real standing).
  - A cleared flag doesn't count toward lifetime strikes; an upheld one
    (via vote or timeout) adds one to `flagHistory`.
- **Escalation**: 3 upheld flags (need not be in the same group) locks the
  app to a single available action — delete all local data — which also
  broadcasts self-revoke to every friend/group so the user's data is purged
  from everyone else's cache too.

## Suggested build order

1. ✅ Canonical exercise id + `romMeters` migration (`exercises-data.js`,
   `app.js` schema bump) — independent of networking, land first.
2. ✅ Identity generation (keypair, username/tag) + IndexedDB stores + QR
   generate/scan UI — done in `identity.js` (new file). ECDSA P-256 via
   WebCrypto (not Ed25519 — broader browser support). QR encode/decode uses
   two vendored libraries (no CDN, cached by the service worker):
   `vendor/qrcode.min.js` + `vendor/qrcode-utf8.min.js` (kazuhikoarase/
   qrcode-generator, MIT) for generation, `vendor/jsQR.min.js` (cozmo/jsQR,
   Apache-2.0) for camera-frame decoding, with a manual paste-code fallback
   for when camera/permissions aren't available. Verified via a Node-based
   simulation of the full encode → rasterize → decode → import pipeline
   (couldn't test in a live browser/camera in this environment — worth a
   manual two-device check before relying on it). Profile fields
   (genderSelf/heightCm/bodyweightKg) deferred to step 5, not yet added.
3. ✅ Relay server (`relay-server/`, Node + `ws`, deploy notes in its
   README) + client WebSocket wrapper (`sync.js`) + outbox flush. Identity
   grew a second keypair — ECDH P-256 alongside the ECDSA one from step 2 —
   since signing keys can't do key agreement; the QR pairing payload now
   carries both. Auth is a signed-nonce challenge; payloads are AES-GCM
   encrypted per-recipient with the ECDH-derived shared secret, so the relay
   only ever sees ciphertext. Step-3 scope used a "ping" as the payload
   type to prove the transport, not real leaderboard data yet — `deliver`
   messages route through `handleIncoming()` in `sync.js`, which is where
   step 4's real event types plug in. Verified locally: ran the actual
   relay against the actual client code (not a reimplementation) over a
   real WebSocket on localhost — paired two identities, sent a ping to an
   offline recipient (confirmed it queues), brought that recipient online
   and confirmed it's delivered and decrypts correctly, then confirmed live
   delivery both directions. Still worth a real test across two devices on
   your AWS relay before trusting it in the wild — this environment has no
   AWS access to deploy to.
4. ✅ Drops engine (`drops.js`, pure aggregation functions) + basic
   per-exercise/total/consistency leaderboard UI (`leaderboards.js`, new
   Leaderboards tab), unisex only, single flat friend list (no groups yet),
   no time windows yet (all-time). Every `workoutLogs` write (both the
   guided-session path and the manual log-sets modal) now also computes a
   Drops event locally and broadcasts it to every paired friend via
   `sync.js`'s `workout-event` message type. Found and fixed a real
   calibration bug by computing concrete numbers rather than trusting the
   formulas on paper: a single shared `DROPS_DIVISOR` made one cardio
   session worth ~500x one strength set (mechanical-work-per-set vs.
   metabolic-energy-per-session are wildly different Joule scales) — split
   into `STRENGTH_DROPS_DIVISOR` (50) and `CARDIO_DROPS_DIVISOR` (1000), see
   the Drops section above for the reasoning. Verified locally: the actual
   drops.js + sync.js + identity.js code, against the actual relay server,
   over a real WebSocket — two devices paired, each logged different
   strength/cardio sets, and every leaderboard (total, per-exercise,
   consistency) matched hand-calculated expected values exactly on both
   sides after sync. Not yet built: gender/height/level slicing, monthly/
   5-month windows, and the dynamic "best fit" home-page resume — all step 5.
5. ✅ Time windows (monthly, 5-month epoch anchored to `2026-01-01`) +
   demographic slices (gender, height bracket, level bracket) + dynamic
   home-page resume, all in `drops.js`/`leaderboards.js`. Gender/height are
   optional self-reported fields on the identity/friend records (Friends →
   Edit, now "Your Profile"), broadcast via a new `profile-update` sync
   message — never sent to the relay in the clear, same E2E channel as
   everything else. Level bracket needed no new sync at all: it's a pure
   function of already-synced cumulative Drops (Bronze/Silver/Gold/
   Platinum at 0/1000/5000/20000, explicitly a starting guess). All three
   leaderboard metrics now take an optional `{since, until, pubkeys}`
   filter that the UI composes from the window + slice pickers, so metric x
   window x slice combine freely instead of needing separate code paths.
   The home-page resume card iterates every combination the viewer
   qualifies for and shows their best few ranks (skips slices they haven't
   set, e.g. no gender saved = skip the gender slice; skips if they have no
   friends yet, since "#1 out of 1" isn't a real placement). Verified: pure
   window/bracket boundary math checked against hand-picked dates and
   heights; a 3-device relay test (see step 3/4 methodology) confirmed a
   `profile-update` broadcast correctly updates a friend's cached
   gender/height, that gender and height slices correctly include/exclude
   people, and that the resume engine surfaces correct, real ranks.
6. ✅ Groups (`groups.js`) + revoke/leave flow. Group invites ride the same
   QR/paste flow as 1:1 pairing — a group invite is a pairing payload with
   `kind:"group-invite"` and a roster of every current member's
   `{pk,ek,n,t}` attached, so scanning one code pairs you with everyone in
   the group in one step (`importFromScannedPayload` in groups.js now
   dispatches between the two payload kinds; used to live only in
   identity.js). Snowball union-find is a bounded local fixed-point loop —
   merge any two locally-known snowball groups that share a member, repeat
   until nothing changes — rather than the plan's literal version-number +
   lexicographic-id tie-break: roster updates are a pure monotonic set
   union (grow-only, commutative, never removes anyone — only an explicit
   revoke does that), which converges regardless of message order without
   needing exact conflict resolution. Leaderboards gained a **scope**
   dimension (All Friends, or one specific group), intersected with the
   existing window/slice filters; the home-page resume now also loops over
   every group.

   Found and fixed two real protocol bugs via testing, both around how a
   brand-new group member gets introduced to *existing* members who never
   scanned that person's code directly:
   - Roster broadcasts originally carried bare pubkeys, which told existing
     members *who* joined but not their actual keys/name — nothing they
     could add as a friend. Broadcasts now carry full `{pk,ek,n,t}` tuples
     (`resolveGroupMembers`), same shape as an invite.
   - The `deliver` handler required the recipient to already have the
     sender as a known friend before it would even attempt decryption —
     circular for an introduction message, since establishing that
     friendship is the whole point. Fixed by having the sender's ECDH
     public key (not a secret) ride in the clear alongside the ciphertext,
     so a recipient can derive the shared secret and decrypt on the very
     first message from someone new; relay-server/server.js passes that
     field through unchanged. This doesn't weaken authenticity — decryption
     still only succeeds if the sender holds the matching private key.

   Verified with a 4-device relay test: a bounded group where A invites B,
   then re-invites with the grown roster to add C, converges to all three
   members on all three devices with correct mutual friend links; two
   snowball groups (A+B, then B+D) correctly union into one shared
   A/B/D roster on all three devices while a separate bounded group stays
   untouched; leaving a group propagates and shrinks the roster everywhere;
   removing a friend still delivers its own revoke notice (the enqueue-
   before-delete ordering fix from earlier held up); and a leaderboard
   scoped to one group correctly excludes non-members.
7. ✅ Backup/restore (`backup.js` local encrypted export/import,
   `drive-backup.js` Google Drive, `backup-ui.js` wiring), built after step
   8 at the user's direction. Both paths share one encrypted blob: PBKDF2
   (300k iterations) derives an AES-GCM key from a user passphrase that's
   never stored anywhere, wrapping a JSON dump of every store except
   `outbox` (a send buffer, not history) plus all of `localStorage`.
   `identity`'s CryptoKey objects (not JSON-serializable) round-trip
   through JWK export/import. Restoring clears every store via a new
   `dbClear()` helper (added to app.js's existing db-helper set — restore
   originally used raw `openDB()`/`db.transaction()` calls that bypassed
   the app's own abstraction and couldn't be tested with the same harness
   as everything else, so it got refactored to match before being
   verified) and reloads with the exact same identity/pubkey, so paired
   friends never notice a reinstall happened.
   - **Google Drive**: OAuth PKCE against the `drive.appdata` scope (a
     hidden per-app folder, nothing else in Drive is touched) — no client
     secret needed, safe for a static PWA. Requires a Google OAuth client
     id the user provisions themselves (Cloud Console has no API I can
     drive from here, same category of limitation as the AWS pieces); it's
     a setting (Friends → Backup), with setup steps in the UI and this
     plan. Same encrypted blob as the local path, uploaded/downloaded
     via Drive API v3's multipart endpoints instead of saved to disk.
   - **Verified**: PKCE code_verifier/code_challenge generation checked
     byte-for-byte against a manual SHA-256 computation; the encrypt/decrypt
     round-trip and wrong-passphrase rejection; and — the test that
     actually matters — a fully independent simulated device with *nothing*
     on it, restored from a real device's exported backup, ends up with the
     exact same pubkey and ECDH key, and a friend who never re-paired with
     anyone can still exchange encrypted pings with the "restored" device
     immediately after. That last check is the actual promise of this
     feature ("friends never notice a change") and it holds. **Not
     verified**: the live Google OAuth/Drive API calls — no client id
     exists to test against from here, so `drive-backup.js` is correct
     against the documented API shapes but unexercised end-to-end.
8. ✅ Red Flag Court (`moderation.js` pure logic + submission/escalation,
   `moderation-ui.js` rendering/wiring), built immediately after step 6 —
   reporting, threshold, voting, mascot/sound/Drops consequences, and
   3-strike lockout are all in and verified; the S3 video-upload piece is
   real, working code that's untested against actual AWS (no credentials in
   this environment) — see below.
   - **Reporting/threshold/voting**: fully event-sourced like everything
     else — `reports`/`courtVotes`/`flagHistory` are local caches, flag
     state is a pure function over them (`flagThreshold`, `flaggedAt`,
     `courtStatus`), never a value some authority declares. Reports and
     votes broadcast to the whole group via `broadcastToGroup` (extracted
     from `groups.js`'s roster broadcaster since both needed the same "fan
     out to every other member" primitive).
   - **Consequences**: split into two audiences on purpose. Mascot
     (`setMascotFlagged`, a CSS-only overlay independent of the existing
     mood system — no new SVG artwork, since that can't be visually
     verified without a browser) and sound (`setFartMode` in sounds.js,
     monkey-patches every `SFX.*` method to a synthesized fart and restores
     the originals when un-flagged) are self-directed: only the flagged
     user's own device shows them. The 0.2x Drops multiplier is what
     *other* people see — a new `flaggedPubkeys` field on the existing
     `filters` object in `drops.js`, applied to the two Drops-valued
     leaderboards but not consistency (a day count, not Drops). Both
     "pending" (still in the court window) and "upheld" carry the
     multiplier; only "cleared" removes it.
   - **Escalation/lockout**: `checkEscalationAndLockout()` runs at boot and
     after any incoming report/vote, finalizes any court window that's
     closed since last checked (writing `flagHistory` exactly once per
     incident), and flips a `localStorage` lockout flag at 3 upheld flags.
     `app.js` checks this before rendering anything and swaps in a
     lockout screen whose only action is `deleteAllMyData()` — wipes every
     store, broadcasts a self-revoke to every friend first so their caches
     purge too, then reloads.
   - **Court video upload (the S3 exception)**: a second, independent HTTP
     service (`relay-server/court-upload-server.js`, separate port,
     separate deploy) issues presigned S3 URLs after the same signed-nonce
     auth the WS relay uses. Caught and fixed a real bug here too: SigV4
     presigned URLs cap out at 7 days no matter what's requested, so the
     original plan of minting one long-lived "view" URL at upload time
     (meant to last the 14-day court window) would have failed outright —
     `courtVideos` now stores the S3 *key*, and a fresh short-lived view
     URL is minted on demand whenever someone actually wants to watch.
   - **Verified**: pure threshold/status/tally functions against hand-built
     cases (crossing the threshold, pending vs. resolved, majority/tie/
     no-quorum outcomes); a 3-device relay test covering the full path —
     report → flag propagates to every device including the target's own,
     mascot/fart consequences fire only on the target's device, a
     third member's leaderboard view shows the flagged user's Drops at
     exactly 20%, a vote propagates and tallies correctly, and backdating
     three separate flag incidents past their court window correctly
     locks the account and records each exactly once. Separately verified
     `court-upload-server.js`'s auth + presigned-URL logic with fake AWS
     credentials (`getSignedUrl` signs locally, never calls AWS, so this
     is real verification) — valid/forged/impersonated/malformed requests
     all get the right status codes and a real-shaped signed URL. **Not
     verified**: an actual PUT/GET against a real S3 bucket, or that the
     documented IAM policy is sufficient — needs a real AWS smoke test.
9. ✅ Polish.
   - **Relay rate limiting**: already adequate from step 3 (20 sends/sec per
     authenticated pubkey) — nothing to add.
   - **Reconnect/backoff**: already exponential from step 3; added full
     jitter (`Math.random() * delay` instead of the raw delay) so a relay
     restart doesn't get hit by every client reconnecting on the exact same
     doubling schedule simultaneously.
   - **QR invite expiry**: genuinely missing before now — both a 1:1
     pairing code and a group invite carried no expiry at all, so an old
     screenshotted code would work forever. Added an `exp` timestamp to
     both payloads (10 minutes for 1:1 pairing — meant for an immediate
     in-person scan; 1 hour for group invites, which more often get passed
     around a room) and rejection on import when expired. Doing this
     surfaced dead code worth cleaning up while touching the same logic:
     `groups.js`'s `importFromScannedPayload` — the dispatcher the UI
     actually calls — had its own inline copy of the 1:1-friend-import
     logic instead of calling `identity.js`'s `importFriendFromPayload`,
     so the expiry check would have silently applied to only one of the
     two paths if added naively. Consolidated to one path.
   - **Verified**: full regression run of the existing group and Red Flag
     Court relay tests confirmed the dedup didn't change behavior, plus a
     dedicated test confirming a fresh code is accepted, a backdated-`exp`
     1:1 code is rejected, and a backdated-`exp` group invite is rejected —
     all against the real shipped code over the real relay.

## Open questions still worth deciding during implementation

- **Level tier thresholds**: what cumulative-Drops cutoffs define each
  level bracket — needs real usage data or a reasonable guess to start.
- **`romMeters` sourcing**: who populates per-exercise ROM estimates for
  the full seed list — a one-time data task, doesn't block the engine.
- **`DROPS_DIVISOR` / cardio `intensity` calibration**: expect to retune
  after seeing real numbers so strength and cardio feel comparable.
- **Court vote quorum**: "simple majority of votes cast" has no minimum
  turnout requirement yet — worth deciding if a tiny group (e.g. 3 people)
  should need more than 1 vote to clear a flag.
- **Gender field privacy**: confirm it's opt-in/undisclosed-by-default and
  only ever shared with friends (already true architecturally, since all
  profile data is E2E-encrypted per-recipient, never sent to the relay in
  the clear) rather than something that could leak group-wide by accident.
- **Real AWS/Google testing**: this whole build happened without any real
  AWS or Google credentials, so three pieces are correct-against-spec but
  genuinely unexercised end-to-end: the relay/court-upload servers against
  real S3 (their auth and presigning logic *is* verified — see step 8 — but
  not an actual bucket), and `drive-backup.js`'s OAuth/Drive calls against
  a real client id. Worth a real smoke test of all three before depending
  on them.
- **Passphrase recovery**: there is none, by design (see backup.js) — a
  forgotten backup passphrase means that backup is gone. Worth deciding if
  that's the right tradeoff or if a recovery-phrase-style mechanism is
  wanted later.
