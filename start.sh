#!/bin/bash
# start.sh — Run this once after your Codespace opens.
# It installs everything and starts both dev servers.
# Safe to re-run at any time to restart the servers.

set -e

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BUSMGMT_DIR="$WORKSPACE/integrations/BusMgmtBenchmarks"
CHAT_LOG="$HOME/.chat-server.log"
BUSMGMT_LOG="$HOME/.busmgmt-server.log"
DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│     llm-chat-bus-dev Setup           │"
echo "└──────────────────────────────────────┘"
echo ""

# ── Step 1: Install upterm ──────────────────────────────────────────────────
# upterm lets instructors share a terminal session for live help.
echo "┄┄┄ Step 1/4: Installing upterm ┄┄┄"
if command -v upterm &>/dev/null; then
  echo "→ upterm already installed, skipping."
else
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" 2>/dev/null || true
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)        ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l)        ARCH="armv6" ;;
    i386|i686)     ARCH="386" ;;
  esac
  TARBALL="upterm_${OS}_${ARCH}.tar.gz"
  echo "→ Downloading $TARBALL..."
  TMP=$(mktemp -d)
  curl -fsSL "https://github.com/owenthereal/upterm/releases/latest/download/${TARBALL}" -o "$TMP/upterm.tar.gz"
  tar -xzf "$TMP/upterm.tar.gz" -C "$TMP"
  sudo mv "$TMP/upterm" /usr/local/bin/upterm
  sudo chmod +x /usr/local/bin/upterm
  rm -rf "$TMP"
  echo "✓ upterm installed."
fi
echo ""

# ── Step 2: Install dependencies ───────────────────────────────────────────
# Uses npm ci (faster than npm install — installs directly from lockfile).
# Also initializes the BusMgmtBenchmarks git submodule if needed.
echo "┄┄┄ Step 2/4: Installing dependencies ┄┄┄"

if [ ! -d "$WORKSPACE/node_modules" ]; then
  echo "→ Installing chat app dependencies..."
  (cd "$WORKSPACE" && npm ci)
  echo "✓ Chat app dependencies installed."
else
  echo "→ Chat app node_modules present, skipping."
fi

if [ ! -f "$BUSMGMT_DIR/package.json" ]; then
  echo "→ Initializing BusMgmt submodule..."
  (cd "$WORKSPACE" && git submodule update --init --recursive)
fi

if [ ! -d "$BUSMGMT_DIR/node_modules" ]; then
  echo "→ Installing BusMgmt dependencies..."
  (cd "$BUSMGMT_DIR" && npm ci)
  echo "✓ BusMgmt dependencies installed."
else
  echo "→ BusMgmt node_modules present, skipping."
fi
echo ""

# ── Step 3: Stop any running servers ───────────────────────────────────────
echo "┄┄┄ Step 3/4: Stopping any running servers ┄┄┄"
for port in 3000 8081; do
  pids=$(lsof -ti :"$port" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "→ Stopping port $port (PID $pids)..."
    kill "$pids" 2>/dev/null || true
    sleep 1
  fi
done
echo ""

# ── Step 4: Start servers ───────────────────────────────────────────────────
echo "┄┄┄ Step 4/4: Starting dev servers ┄┄┄"

# BusMgmt on port 3000
echo "→ Starting BusMgmt server..."
nohup bash -c "cd '$WORKSPACE' && npm run dev:busmgmt" > "$BUSMGMT_LOG" 2>&1 &

# Wait up to 60s for BusMgmt to be ready before starting the chat app
ELAPSED=0
until curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge 60 ]; then
    echo "⚠ BusMgmt did not respond within 60s. Check: tail -f $BUSMGMT_LOG"
    break
  fi
done
[ "$ELAPSED" -lt 60 ] && echo "✓ BusMgmt ready."

# Chat app on port 8081
echo "→ Starting chat app..."
nohup bash -c "cd '$WORKSPACE' && npm run dev" > "$CHAT_LOG" 2>&1 &
echo "✓ Chat app started."
echo ""

# ── URLs ────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────┐"
echo "│     ✓ Ready!                         │"
echo "└──────────────────────────────────────┘"
echo ""
echo "  Chat app : https://${CODESPACE_NAME}-8081.${DOMAIN}"
echo "  BusMgmt  : https://${CODESPACE_NAME}-3000.${DOMAIN}"
echo ""
echo "  Logs:"
echo "    tail -f $CHAT_LOG"
echo "    tail -f $BUSMGMT_LOG"
echo ""
echo "  Restart anytime: bash start.sh"
echo ""
