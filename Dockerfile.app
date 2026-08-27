# Serves the static PWA (index.html + the JS/CSS files at repo root) —
# built and pushed to the same ECR repo as the relay images, as the "app"
# tag, per relay-server/README.md's Option B. The host's own Caddy handles
# TLS and reverse-proxies to this container; see Caddyfile.app.
FROM caddy:2-alpine
COPY Caddyfile.app /etc/caddy/Caddyfile
COPY . /srv
# Not part of the app itself — just where they land from the `COPY . /srv`
# above alongside the real static files.
RUN rm -f /srv/Dockerfile.app /srv/Caddyfile.app
EXPOSE 80
