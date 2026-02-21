#!/bin/bash
# start-dev.sh — starts both dev servers for llm-chat-bus-dev

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
LOG="$HOME/.dev-server.log"
BUSMGMT_LOG="$HOME/.busmgmt-server.log"
BUSMGMT_DIR="$WORKSPACE/integrations/BusMgmtBenchmarks"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│   llm-chat-bus-dev Dev Servers       │"
echo "└──────────────────────────────────────┘"
echo ""

# Kill anything currently running on a given port
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "→ Stopping process on port $port (PID $pids)..."
    kill $pids 2>/dev/null
    sleep 1
  fi
}

kill_port 3000
kill_port 8081
rm -f ~/.busmgmt-server.pid ~/.dev-server.pid

# Ensure submodule is initialized
if [ ! -f "$BUSMGMT_DIR/package.json" ]; then
  echo "→ Initializing BusMgmt submodule..."
  (cd "$WORKSPACE" && git submodule update --init --recursive)
fi

# Ensure BusMgmt dependencies are installed
if [ ! -d "$BUSMGMT_DIR/node_modules" ]; then
  echo "→ Installing BusMgmt dependencies..."
  (cd "$BUSMGMT_DIR" && npm install)
fi

# Start BusMgmt submodule server on port 3000
echo "→ Starting BusMgmt server on port 3000..."
nohup bash -c "cd '$WORKSPACE' && npm run dev:busmgmt" > "$BUSMGMT_LOG" 2>&1 &
echo $! > ~/.busmgmt-server.pid

# Wait for BusMgmt to be ready (60 second timeout)
echo "→ Waiting for BusMgmt to be ready..."
TIMEOUT=60
ELAPSED=0
until curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠ BusMgmt did not start within ${TIMEOUT}s. Check logs: tail -f $BUSMGMT_LOG"
    break
  fi
done

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✓ BusMgmt ready on port 3000."
fi

echo ""

# Start chat wrapper on port 8081
echo "→ Starting chat app on port 8081..."
nohup bash -c "cd '$WORKSPACE' && npm run dev" > "$LOG" 2>&1 &
echo $! > ~/.dev-server.pid

echo ""
echo "✓ Dev servers started in the background."
echo ""
echo "  Chat app:  http://localhost:8081  (logs: tail -f $LOG)"
echo "  BusMgmt:   http://localhost:3000  (logs: tail -f $BUSMGMT_LOG)"
echo ""
echo "  Restart: bash $WORKSPACE/start-dev.sh"
echo ""
echo "  → Check the Ports tab in VS Code to open your app."
echo ""
