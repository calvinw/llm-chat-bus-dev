#!/bin/bash
# start-dev.sh — starts both dev servers for llm-chat-bus-dev

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
LOG="$HOME/.dev-server.log"
BUSMGMT_LOG="$HOME/.busmgmt-server.log"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│   llm-chat-bus-dev Dev Servers       │"
echo "└──────────────────────────────────────┘"
echo ""

# Stop any previously running dev servers
if [ -f ~/.busmgmt-server.pid ]; then
  OLD_PID=$(cat ~/.busmgmt-server.pid)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "→ Stopping previous BusMgmt server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null
    sleep 1
  fi
  rm -f ~/.busmgmt-server.pid
fi

if [ -f ~/.dev-server.pid ]; then
  OLD_PID=$(cat ~/.dev-server.pid)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "→ Stopping previous chat server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null
    sleep 1
  fi
  rm -f ~/.dev-server.pid
fi

# Start BusMgmt submodule server on port 3000
echo "→ Starting BusMgmt server on port 3000..."
nohup bash -c "cd '$WORKSPACE' && npm run dev:busmgmt" > "$BUSMGMT_LOG" 2>&1 &
echo $! > ~/.busmgmt-server.pid

# Wait for BusMgmt to be ready
echo "→ Waiting for BusMgmt to be ready..."
until curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
done
echo "✓ BusMgmt ready on port 3000."

echo ""

# Start chat wrapper on port 8081
echo "→ Starting chat app on port 8081..."
nohup bash -c "cd '$WORKSPACE' && npm run dev" > "$LOG" 2>&1 &
echo $! > ~/.dev-server.pid

echo ""
echo "✓ Both dev servers started in the background."
echo ""
echo "  Chat app:  http://localhost:8081  (logs: tail -f $LOG)"
echo "  BusMgmt:   http://localhost:3000  (logs: tail -f $BUSMGMT_LOG)"
echo ""
echo "  Stop:    kill \$(cat ~/.dev-server.pid) \$(cat ~/.busmgmt-server.pid)"
echo "  Restart: bash $WORKSPACE/start-dev.sh"
echo ""
echo "  → Check the Ports tab in VS Code to open your app."
echo ""
