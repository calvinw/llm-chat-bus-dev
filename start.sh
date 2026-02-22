#!/bin/bash
# start.sh — Setup and dev server launcher for llm-chat-bus-dev
#
# Run this script once after your Codespace is ready, or any time you want to
# restart the dev servers. It is safe to run multiple times — installs are
# skipped when already present, and running servers are stopped cleanly first.
#
# Steps:
#   1. Install upterm (terminal-sharing tool) — skipped if already installed
#   2. Install chat app npm dependencies   — skipped if node_modules exists
#   3. Initialize BusMgmt git submodule    — skipped if already initialized
#   4. Install BusMgmt npm dependencies   — skipped if node_modules exists
#   5. Stop any running servers on ports 3000 and 8081
#   6. Start BusMgmt dev server on port 3000
#   7. Start chat app dev server on port 8081

set -e

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
LOG="$HOME/.dev-server.log"
BUSMGMT_LOG="$HOME/.busmgmt-server.log"
BUSMGMT_DIR="$WORKSPACE/integrations/BusMgmtBenchmarks"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│     llm-chat-bus-dev Setup           │"
echo "└──────────────────────────────────────┘"
echo ""

# ── Step 1: Install upterm ──────────────────────────────────────────────────
# upterm lets you share a terminal session — useful for collaborative debugging.
echo "┄┄┄ Step 1/7: upterm ┄┄┄"
if command -v upterm &>/dev/null; then
  echo "→ upterm already installed, skipping."
else
  # upterm needs an SSH key to establish secure sessions
  echo "→ Generating SSH key (required by upterm)..."
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" 2>/dev/null || true

  # Detect OS and CPU architecture, then normalize to upterm's release naming
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)        ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l)        ARCH="armv6" ;;
    i386|i686)     ARCH="386" ;;
  esac

  TARBALL="upterm_${OS}_${ARCH}.tar.gz"
  echo "→ Downloading $TARBALL from GitHub releases..."
  TMP_DIR=$(mktemp -d)
  curl -fsSL "https://github.com/owenthereal/upterm/releases/latest/download/${TARBALL}" \
    -o "$TMP_DIR/upterm.tar.gz"
  tar -xzf "$TMP_DIR/upterm.tar.gz" -C "$TMP_DIR"
  sudo mkdir -p /usr/local/bin
  sudo mv "$TMP_DIR/upterm" /usr/local/bin/upterm
  sudo chmod +x /usr/local/bin/upterm
  rm -rf "$TMP_DIR"
  echo "✓ upterm installed."
fi
echo ""

# ── Step 2: Install chat app dependencies ──────────────────────────────────
# Installs the React/Vite/Tailwind dependencies for the main chat wrapper.
echo "┄┄┄ Step 2/7: Chat app npm dependencies ┄┄┄"
if [ -d "$WORKSPACE/node_modules" ]; then
  echo "→ node_modules already present, skipping."
else
  echo "→ Running npm install in $WORKSPACE..."
  (cd "$WORKSPACE" && npm install --progress)
  echo "✓ Chat app dependencies installed."
fi
echo ""

# ── Step 3: Initialize git submodule ───────────────────────────────────────
# The BusMgmtBenchmarks financial comparison app lives in a git submodule.
echo "┄┄┄ Step 3/7: BusMgmt git submodule ┄┄┄"
if [ -f "$BUSMGMT_DIR/package.json" ]; then
  echo "→ Submodule already initialized, skipping."
else
  echo "→ Fetching submodule from GitHub (this may take a moment)..."
  (cd "$WORKSPACE" && git submodule update --init --recursive --progress)
  echo "✓ Submodule initialized."
fi
echo ""

# ── Step 4: Install BusMgmt dependencies ───────────────────────────────────
# Installs npm packages for the BusMgmtBenchmarks submodule separately,
# since it has its own package.json and node_modules.
echo "┄┄┄ Step 4/7: BusMgmt npm dependencies ┄┄┄"
if [ -d "$BUSMGMT_DIR/node_modules" ]; then
  echo "→ BusMgmt node_modules already present, skipping."
else
  echo "→ Running npm install in integrations/BusMgmtBenchmarks..."
  (cd "$WORKSPACE" && npm --prefix integrations/BusMgmtBenchmarks install --progress)
  echo "✓ BusMgmt dependencies installed."
fi
echo ""

# ── Step 5: Stop any existing dev servers ──────────────────────────────────
# Kills whatever is running on ports 3000 and 8081 so we get a clean start.
echo "┄┄┄ Step 5/7: Stopping any running dev servers ┄┄┄"
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "→ Stopping process on port $port (PID $pids)..."
    kill "$pids" 2>/dev/null || true
    sleep 1
  else
    echo "→ Nothing running on port $port."
  fi
}
kill_port 3000
kill_port 8081
rm -f ~/.busmgmt-server.pid ~/.dev-server.pid
echo ""

# ── Step 6: Start BusMgmt dev server ───────────────────────────────────────
# Runs the financial comparison iframe app (Vite) on port 3000 in the background.
# Waits up to 60 seconds for it to become ready before continuing.
echo "┄┄┄ Step 6/7: Starting BusMgmt server (port 3000) ┄┄┄"
nohup bash -c "cd '$WORKSPACE' && npm run dev:busmgmt" > "$BUSMGMT_LOG" 2>&1 &
echo $! > ~/.busmgmt-server.pid
echo "→ Waiting for BusMgmt to be ready (up to 60s)..."
TIMEOUT=60
ELAPSED=0
until curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "⚠ BusMgmt did not start within ${TIMEOUT}s."
    echo "  Check logs: tail -f $BUSMGMT_LOG"
    break
  fi
done
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✓ BusMgmt ready on port 3000."
fi
echo ""

# ── Step 7: Start chat app dev server ──────────────────────────────────────
# Runs the React chat wrapper (Vite) on port 8081 in the background.
echo "┄┄┄ Step 7/7: Starting chat app (port 8081) ┄┄┄"
nohup bash -c "cd '$WORKSPACE' && npm run dev" > "$LOG" 2>&1 &
echo $! > ~/.dev-server.pid
echo "✓ Chat app started on port 8081."
echo ""

# ── Done ────────────────────────────────────────────────────────────────────
# Build Codespace URLs using environment variables set by GitHub Codespaces
DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
CHAT_URL="https://${CODESPACE_NAME}-8081.${DOMAIN}"
BUSMGMT_URL="https://${CODESPACE_NAME}-3000.${DOMAIN}"

echo "┌──────────────────────────────────────┐"
echo "│     ✓ All done!                      │"
echo "└──────────────────────────────────────┘"
echo ""
echo "  Chat app : $CHAT_URL"
echo "  BusMgmt  : $BUSMGMT_URL"
echo ""
echo "  Logs:"
echo "    tail -f $LOG          (chat app)"
echo "    tail -f $BUSMGMT_LOG  (BusMgmt)"
echo ""
echo "  To restart servers: bash $WORKSPACE/start.sh"
echo ""
