# FitTrack relay

A small WebSocket server that routes end-to-end encrypted messages between
paired FitTrack devices. It authenticates each connection against the
device's public key, forwards messages live when both sides are online, and
holds undelivered messages in memory (never on disk) for up to 3 days. See
the header comment in `server.js` for the wire protocol, and
`../.claude/plans/social-leaderboards.md` for why it's built this way.

## Run locally

```
npm install
npm start
```

Listens on `ws://localhost:8787` by default (override with `PORT=...`).
Point the app at it from **Friends → Sync** using `ws://<your-machine-ip>:8787`
— two devices on the same Wi-Fi can pair and sync against this without any
deployment at all.

## Deploying to your AWS box

The server has no database and no external dependencies beyond `ws`, so it
runs anywhere Node does. Two ways to run it on the instance — plain Node
under systemd, or as a container pulled from ECR. Pick one.

### Option A: plain Node + systemd

1. Copy this folder to the instance, `npm install --production`.
2. Run it under a process manager so it survives reboots/crashes, e.g.
   `systemd`:

   ```ini
   # /etc/systemd/system/fittrack-relay.service
   [Unit]
   Description=FitTrack relay
   After=network.target

   [Service]
   ExecStart=/usr/bin/node /opt/fittrack-relay/server.js
   Environment=PORT=8787
   Restart=always
   User=nobody

   [Install]
   WantedBy=multi-user.target
   ```

   `sudo systemctl enable --now fittrack-relay`.

### Option B: Docker + ECR

Build once on your own machine, push to ECR, pull on the instance — no
Node toolchain needed on the box itself, and updates are just `docker
compose pull && docker compose up -d`.

1. **Build and push** from your own machine (needs Docker + AWS CLI
   configured with ECR push permissions):

   ```
   ECR_REPO=<account-id>.dkr.ecr.<region>.amazonaws.com/<your-repo> ./scripts/build-and-push.sh
   ```

   Both images land in that one ECR repo as two tags — `:relay` and
   `:court-upload` — rather than two separate repos, since one repo can
   hold both just fine. Creates the repo if it doesn't exist yet, builds
   both images (`Dockerfile.relay`, `Dockerfile.court-upload` — separate
   slim images since the relay only needs `ws` and the court-upload
   service only needs the AWS SDK, not one image with both), and pushes
   them.

2. **On the instance**, install Docker and the compose plugin (Amazon
   Linux 2023: `sudo dnf install -y docker docker-compose-plugin && sudo
   systemctl enable --now docker && sudo usermod -aG docker $USER` — log
   out/in for the group change to apply), then copy `docker-compose.yml`
   and `.env.example` (as `.env`, filled in with the same `ECR_REPO`) to
   the instance and run:

   ```
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   docker compose pull
   docker compose up -d
   ```

   The instance needs an IAM role attached (see step 2 of the S3 setup
   below) with ECR pull permissions (`AmazonEC2ContainerRegistryReadOnly`
   is fine) in addition to the S3 permissions, if you're running the
   court-upload container too.

   **IMDS hop-limit gotcha**: `court-upload-server.js` gets its AWS
   credentials from the instance's IAM role via the metadata service
   (no keys in the container, on purpose). If the instance enforces
   IMDSv2 (the default on new instances), its metadata hop limit defaults
   to 1 — one hop too few once the request is going through Docker's
   bridge network — so the SDK inside the container will fail to find
   credentials until you raise it:

   ```
   aws ec2 modify-instance-metadata-options --instance-id <id> --http-put-response-hop-limit 2 --region us-east-1
   ```

   If you're not running the court-upload container, this doesn't apply —
   the relay itself never touches AWS credentials.

Either way (Option A or B), continue with:

3. **TLS**: browsers require `wss://` (not `ws://`) from an HTTPS page, and
   this PWA will be served over HTTPS. Put a reverse proxy in front that
   terminates TLS and forwards to the plain `ws://localhost:8787` above —
   Caddy is the least fuss (automatic Let's Encrypt certs):

   ```
   relay.yourdomain.com {
     reverse_proxy localhost:8787
   }
   ```

   nginx works too if you already run it for something else; just proxy
   `Upgrade`/`Connection` headers through for the WebSocket handshake.

   **Serving the app itself from the same box?** It's a separate Caddy site
   block on a different (sub)domain, reverse-proxying to the `app` image's
   container port (`8080` in `docker-compose.yml`) instead of the relay's:

   ```
   relay.yourdomain.com {
     reverse_proxy localhost:8787
   }

   app.yourdomain.com {
     reverse_proxy localhost:8080
   }
   ```

   No domain yet? [sslip.io](https://sslip.io)/[nip.io](https://nip.io) give
   free wildcard DNS with zero signup — `<label>.<your-ip-with-dots>.sslip.io`
   resolves straight to that IP, and Caddy can issue a real Let's Encrypt
   cert for it exactly like a real domain.

4. Open the port in your security group: 443 (or 80+443 if Caddy is issuing
   certs itself) inbound from anywhere; the instance never needs 8787/8080
   exposed directly since the reverse proxy is on the same box.

5. Point the app at `wss://relay.yourdomain.com` from Friends → Sync.

## What this does *not* do

No accounts, no database, no persistence beyond the in-memory queue's TTL.
If you need to see it's alive, `wscat -c ws://localhost:8787` and expect a
`{"type":"challenge",...}` message immediately.

## Red Flag Court video uploads (optional companion service)

`court-upload-server.js` is a separate small HTTP service, independent of
the WebSocket relay above — only needed if you want Red Flag Court defense
videos to work. It never sees video bytes itself: it authenticates the
requester (same signed-nonce pattern as the relay) and hands back a
presigned S3 URL for the client to upload/download directly. See its header
comment for the two endpoints.

1. **Create an S3 bucket** (private, no public access) and add a lifecycle
   rule expiring objects under the `court/` prefix after ~14 days — that's
   what actually enforces "the server doesn't keep this forever," not
   application code:

   ```json
   {
     "Rules": [{
       "ID": "expire-court-videos",
       "Filter": { "Prefix": "court/" },
       "Status": "Enabled",
       "Expiration": { "Days": 14 }
     }]
   }
   ```

2. **IAM**: the identity this process runs as (an IAM role if on EC2, or an
   access key via env vars otherwise) needs `s3:PutObject` and
   `s3:GetObject` scoped to `arn:aws:s3:::your-bucket/court/*`. Nothing
   broader than that.

3. **Run it**:

   ```
   COURT_BUCKET=your-bucket-name AWS_REGION=us-east-1 node court-upload-server.js
   ```

   Listens on `:8788` by default (`COURT_UPLOAD_PORT` to override). Same
   systemd + reverse-proxy pattern as the relay works here too — it's a
   second independent process/port, so give it its own systemd unit
   (`ExecStart=/usr/bin/node /opt/fittrack-relay/court-upload-server.js`)
   and its own reverse-proxy block if you want it on `https://`. Deploying
   via Docker instead? See "Option B: Docker + ECR" above — the
   `fittrack-court-upload` image runs this same file, and `docker-compose.yml`
   already wires up `COURT_BUCKET`/`AWS_REGION`.

4. Point the app at it from **Friends → Sync → Court video upload
   endpoint**, e.g. `https://court.yourdomain.com`.

**Tested without real AWS access**: the auth verification and presigned-URL
generation logic is exercised in `court-upload-server.js`'s own tests using
fake credentials — `getSignedUrl` signs locally and never calls AWS, so that
part is genuinely verified. What is *not* verified here is an actual PUT/GET
against a real bucket, or that the IAM policy above is sufficient — worth a
real smoke test once you've created the bucket.
