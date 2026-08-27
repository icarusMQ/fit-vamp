// Companion HTTP service for Red Flag Court video evidence — the one
// deliberate exception to "the relay stores nothing" (see server.js's
// header and ../.claude/plans/social-leaderboards.md, "Red Flag Court").
// Issues short-lived presigned S3 URLs after verifying the requester
// actually holds the private key for the pubkey they claim — the same
// signed-nonce pattern the WebSocket relay uses for its own auth. Video
// bytes never pass through this process: the client PUTs directly to S3
// using the presigned URL this hands back, and reads it back the same way.
//
// Requires an S3 bucket with a lifecycle rule that expires objects under
// the `court/` prefix after ~14 days (the court window) — see README.md
// for the bucket policy and IAM permissions this needs. Credentials come
// from the standard AWS SDK chain (env vars, or an IAM role if this runs on
// EC2) — nothing is hardcoded here.

const http = require("http");
const crypto = require("crypto").webcrypto;
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const PORT = process.env.COURT_UPLOAD_PORT || 8788;
const BUCKET = process.env.COURT_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";
const UPLOAD_URL_TTL_SEC = 5 * 60;
// SigV4 presigned URLs cap out at 7 days no matter what you ask for — well
// under the 14-day court window — so a "view" URL is minted fresh on
// request instead of once at upload time and stored for the whole window.
const VIEW_URL_TTL_SEC = 60 * 60;

function b64UrlToBuf(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Buffer.from(b64, "base64");
}

async function verifySignature(pubkeyB64, nonce, sigB64) {
  try {
    const key = await crypto.subtle.importKey("raw", b64UrlToBuf(pubkeyB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64UrlToBuf(sigB64), Buffer.from(nonce, "utf8"));
  } catch {
    return false;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

// Exported so a test can pass in a fake S3Client (or fake credentials) and
// exercise the real auth + presigning logic without touching real AWS.
function createServer({ s3Client, bucket = BUCKET } = {}) {
  const s3 = s3Client || new S3Client({ region: REGION });

  return http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (req.method === "POST" && req.url === "/court-upload-url") {
      let body;
      try { body = await readJsonBody(req); } catch { res.writeHead(400); res.end("bad json"); return; }
      const { pubkey, nonce, sig, targetPubkey, groupId, contentType } = body;
      if (!pubkey || !nonce || !sig || !targetPubkey || !groupId) { res.writeHead(400); res.end("missing fields"); return; }
      // Only the accused can request an upload slot for their own defense.
      if (pubkey !== targetPubkey) { res.writeHead(403); res.end("only the target can submit a defense"); return; }
      const ok = await verifySignature(pubkey, nonce, sig);
      if (!ok) { res.writeHead(401); res.end("bad signature"); return; }

      const ext = (contentType || "video/webm").includes("mp4") ? "mp4" : "webm";
      const key = `court/${groupId}/${targetPubkey}/${Date.now()}.${ext}`;
      try {
        const uploadUrl = await getSignedUrl(
          s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || "video/webm" }),
          { expiresIn: UPLOAD_URL_TTL_SEC }
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ uploadUrl, key }));
      } catch (err) {
        console.error(err);
        res.writeHead(502); res.end("s3 error");
      }
      return;
    }

    // Mints a fresh short-lived viewing URL on demand — courtVideos stores
    // only the S3 key (see moderation.js), not a URL, since no single
    // presigned URL can legally live for the whole 14-day court window.
    if (req.method === "POST" && req.url === "/court-video-url") {
      let body;
      try { body = await readJsonBody(req); } catch { res.writeHead(400); res.end("bad json"); return; }
      const { pubkey, nonce, sig, key } = body;
      if (!pubkey || !nonce || !sig || !key) { res.writeHead(400); res.end("missing fields"); return; }
      if (!key.startsWith("court/")) { res.writeHead(400); res.end("bad key"); return; }
      const ok = await verifySignature(pubkey, nonce, sig);
      if (!ok) { res.writeHead(401); res.end("bad signature"); return; }
      try {
        const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: VIEW_URL_TTL_SEC });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url }));
      } catch (err) {
        console.error(err);
        res.writeHead(502); res.end("s3 error");
      }
      return;
    }

    res.writeHead(404); res.end();
  });
}

if (require.main === module) {
  if (!BUCKET) { console.error("COURT_BUCKET env var is required."); process.exit(1); }
  createServer().listen(PORT, () => console.log(`Court upload service listening on :${PORT}`));
}

module.exports = { createServer, verifySignature, b64UrlToBuf };
