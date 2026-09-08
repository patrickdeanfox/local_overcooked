#!/usr/bin/env bash
# Launches the game on this machine: finds a running game server or starts one, then opens the
# browser at http://localhost:<port>/ (localhost counts as a secure context, so gamepads work
# here without https). Installed by tools/install-launcher.sh next to dist/.
# Env: PORT (7777, the first port to try), LAUNCH_NO_BROWSER=1 (start the server only).
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRST_PORT="${PORT:-7777}"
PORT_TRIES=10
LOG="$HERE/server.log"
WAIT_SECONDS=8
MARKER='<title>Local Overcooked</title>'

find_node() {
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  local candidate
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node /usr/local/bin/node /usr/bin/node /snap/bin/node; do
    [ -x "$candidate" ] && { echo "$candidate"; return; }
  done
  return 1
}

# True when OUR game answers on the port (another service may hold the default port).
game_on_port() {
  local port="$1" response
  response="$( { exec 3<>"/dev/tcp/127.0.0.1/$port" || exit 1
                 printf 'GET / HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3
                 timeout 2 cat <&3; } 2>/dev/null )"
  [[ "$response" == *"$MARKER"* ]]
}

# Echoes the port the game answers on, if any.
find_game_port() {
  local port
  for ((port = FIRST_PORT; port < FIRST_PORT + PORT_TRIES; port++)); do
    if game_on_port "$port"; then echo "$port"; return 0; fi
  done
  return 1
}

notify() {
  echo "$1" >&2
  command -v notify-send >/dev/null 2>&1 && notify-send "Local Overcooked" "$1"
}

start_server() {
  local node
  node="$(find_node)" || { notify "Node.js not found. Install Node 18+ and run the launcher again."; exit 1; }
  (cd "$HERE" && PORT="$FIRST_PORT" nohup "$node" server.mjs >"$LOG" 2>&1 &)
  local waited=0
  until GAME_PORT="$(find_game_port)"; do
    sleep 0.25
    waited=$((waited + 1))
    if [ "$waited" -ge $((WAIT_SECONDS * 4)) ]; then notify "The game server did not start. See $LOG"; exit 1; fi
  done
}

open_browser() {
  local url="$1" browser
  for browser in brave-browser google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$browser" >/dev/null 2>&1; then
      "$browser" --app="$url" >/dev/null 2>&1 &
      return
    fi
  done
  xdg-open "$url" >/dev/null 2>&1 &
}

GAME_PORT="$(find_game_port)" || start_server
URL="http://localhost:${GAME_PORT}/"
[ "${LAUNCH_NO_BROWSER:-0}" = "1" ] || open_browser "$URL"
echo "Local Overcooked is running at $URL"
