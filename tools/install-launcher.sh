#!/usr/bin/env bash
# Installs a desktop launcher for this machine (Linux).
#   npm run install-launcher        (builds dist/ first when it is missing; --build forces a rebuild)
# Copies the built game to ~/.local/share/local-overcooked, writes launch.sh + icon there, and
# creates "Local Overcooked" in the applications menu and on the Desktop. Re-run after updating.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/local-overcooked"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
ENTRY="local-overcooked.desktop"

if [ ! -d "$ROOT/dist" ] || [ "${1:-}" = "--build" ]; then
  echo "Building the game..."
  (cd "$ROOT" && npm run build)
fi

mkdir -p "$INSTALL_DIR/tools" "$APPS_DIR"
rm -rf "$INSTALL_DIR/dist"
cp -r "$ROOT/dist" "$INSTALL_DIR/dist"
cp "$ROOT/server.mjs" "$INSTALL_DIR/server.mjs"
cp "$ROOT/tools/make-cert.mjs" "$INSTALL_DIR/tools/make-cert.mjs"
cp "$ROOT/tools/launch.sh" "$INSTALL_DIR/launch.sh"
chmod +x "$INSTALL_DIR/launch.sh"

ICON="applications-games"
if python3 -c "import PIL" >/dev/null 2>&1; then
  python3 "$ROOT/tools/make-icon.py" "$INSTALL_DIR/icon.png" 256 >/dev/null && ICON="$INSTALL_DIR/icon.png"
fi

cat >"$APPS_DIR/$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Local Overcooked
Comment=Two-player Overcooked clone in the browser
Exec=$INSTALL_DIR/launch.sh
Icon=$ICON
Terminal=false
Categories=Game;
StartupNotify=false
EOF
chmod +x "$APPS_DIR/$ENTRY"

if [ -d "$DESKTOP_DIR" ]; then
  cp "$APPS_DIR/$ENTRY" "$DESKTOP_DIR/$ENTRY"
  chmod +x "$DESKTOP_DIR/$ENTRY"
  # GNOME and Cinnamon only run desktop launchers they consider trusted.
  command -v gio >/dev/null 2>&1 && gio set "$DESKTOP_DIR/$ENTRY" metadata::trusted true 2>/dev/null || true
fi

echo "Installed:"
echo "  game     $INSTALL_DIR"
echo "  menu     $APPS_DIR/$ENTRY"
[ -d "$DESKTOP_DIR" ] && echo "  desktop  $DESKTOP_DIR/$ENTRY"
echo "Double-click 'Local Overcooked' on the Desktop to play. It starts the server if needed and opens the game in the browser."
