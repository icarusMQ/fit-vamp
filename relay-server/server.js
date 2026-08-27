// FitTrack relay — routes end-to-end encrypted messages between paired
// devices. Deliberately stateless: nothing is ever written to disk. If this
// process restarts, only messages queued-but-undelivered at that instant
// are lost — clients re-send anything still in their local outbox on their
// own next reconnect, so restarts are safe, not just tolerated.
//
// Protocol (all messages are JSON over one WebSocket connection):
//   server -> client  { type: "challenge", nonce }              on connect
//   client -> server  { type: "auth", pubkey, sig }              sig = ECDSA-P256(nonce) with the client's private key
//   server -> client  { type: "auth-ok" }                        then flushes anything queued for this pubkey
//   client -> server  { type: "send", to, payload }              payload is opaque ciphertext; server never decrypts it
//   server -> client  { type: "deliver", from, payload, ts }     forwarded live, or replayed from the queue on next connect
//
// See ../.claude/plans/social-leaderboards.md for the full design and
// ../identity.js + ../sync.js for the client side of this same protocol.

const { WebSocketServer } = require("ws");
const crypto = require("crypto").webcrypto;

const PORT = process.env.PORT || 8787;
const QUEUE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // undelivered messages expire after 3 days
const MAX_QUEUED_PER_RECIPIENT = 500; // oldest dropped first past this
const RATE_LIMIT_PER_SEC = 20; // per authenticated pubkey, on "send"
const HEARTBEAT_MS = 30 * 1000;

const wss = new WebSocketServer({ port: PORT });

const connections = new Map(); // pubkeyB64 -> ws
const queues = new Map(); // pubkeyB64 -> [{ from, payload, ts, expiresAt }]
const rateBuckets = new Map(); // pubkeyB64 -> { count, windowStart }

function b64UrlToBuf(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Buffer.from(b64, "base64");
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function verifySignature(pubkeyB64, nonce, sigB64) {
  try {
    const key = await crypto.subtle.importKey(
      "raw", b64UrlToBuf(pubkeyB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, key, b64UrlToBuf(sigB64), Buffer.from(nonce, "utf8")
    );
  } catch {
    return false;
  }
}

function flushQueueTo(pubkey, ws) {
  const q = queues.get(pubkey);
  if (!q || !q.length) return;
  const now = Date.now();
  for (const msg of q) {
    if (msg.expiresAt > now) {
      // Replay the full envelope (minus the queue-only expiresAt), same
      // shape as the live-delivery path — dropping fromEcdhPubkey here would
      // silently break introductions to recipients who were offline.
      const { expiresAt, ...envelope } = msg;
      send(ws, { type: "deliver", ...envelope });
    }
  }
  queues.delete(pubkey);
}

function withinRateLimit(pubkey) {
  const now = Date.now();
  let bucket = rateBuckets.get(pubkey);
  if (!bucket || now - bucket.windowStart > 1000) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(pubkey, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_PER_SEC;
}

wss.on("connection", (ws) => {
  let authedPubkey = null;
  const nonce = crypto.randomUUID();
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  send(ws, { type: "challenge", nonce });

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "auth") {
      if (authedPubkey) return; // already authenticated on this connection
      if (typeof msg.pubkey !== "string" || typeof msg.sig !== "string") return ws.close();
      const ok = await verifySignature(msg.pubkey, nonce, msg.sig);
      if (!ok) return ws.close();

      authedPubkey = msg.pubkey;
      const prior = connections.get(authedPubkey);
      if (prior && prior !== ws) prior.close(); // one live connection per pubkey
      connections.set(authedPubkey, ws);
      send(ws, { type: "auth-ok" });
      flushQueueTo(authedPubkey, ws);
      return;
    }

    if (!authedPubkey) return; // ignore anything before a successful auth

    if (msg.type === "send") {
      if (typeof msg.to !== "string" || typeof msg.payload !== "string") return;
      if (msg.payload.length > 200_000) return; // guard against absurd payloads (not a hard app limit, just sanity)
      if (!withinRateLimit(authedPubkey)) return;

      // fromEcdhPubkey is a public key, not a secret — passed through
      // as-is so the recipient can decrypt even on the first message
      // it's ever received from this sender (see sync.js).
      const envelope = {
        from: authedPubkey, payload: msg.payload, ts: Date.now(),
        ...(typeof msg.fromEcdhPubkey === "string" ? { fromEcdhPubkey: msg.fromEcdhPubkey } : {}),
      };
      const target = connections.get(msg.to);
      if (target && target.readyState === target.OPEN) {
        send(target, { type: "deliver", ...envelope });
      } else {
        const q = queues.get(msg.to) || [];
        q.push({ ...envelope, expiresAt: Date.now() + QUEUE_TTL_MS });
        while (q.length > MAX_QUEUED_PER_RECIPIENT) q.shift();
        queues.set(msg.to, q);
      }
      return;
    }
  });

  ws.on("close", () => {
    if (authedPubkey && connections.get(authedPubkey) === ws) connections.delete(authedPubkey);
  });
});

// Drop dead connections (e.g. a phone that lost network without a clean
// close) so `connections` doesn't accumulate stale sockets.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);
wss.on("close", () => clearInterval(heartbeat));

// Sweep expired queued messages so memory doesn't grow from recipients who
// never come back.
setInterval(() => {
  const now = Date.now();
  for (const [pubkey, q] of queues) {
    const kept = q.filter((m) => m.expiresAt > now);
    if (kept.length) queues.set(pubkey, kept); else queues.delete(pubkey);
  }
}, 60 * 1000).unref();

console.log(`FitTrack relay listening on :${PORT}`);
