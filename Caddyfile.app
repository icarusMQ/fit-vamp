# Internal file server for the container — plain HTTP only, since the host's
# own Caddy (relay-server/README.md) terminates TLS and reverse-proxies here.
:80 {
  root * /srv
  file_server
  encode gzip

  # sw.js must never be cached by an intermediary — the app's own update
  # mechanism (sw.js's CACHE_NAME bump) only works if the browser actually
  # re-fetches this file on each load to notice a new version.
  @sw path /sw.js
  header @sw Cache-Control "no-cache"
}
