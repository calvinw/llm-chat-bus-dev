#!/bin/bash
# postcreate.sh — runs once when the Codespace container is first created

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│     Codespace Setup                  │"
echo "└──────────────────────────────────────┘"
echo ""
echo "This will take a few minutes. Please wait..."
echo ""

# ── Step 1: Install upterm ──────────────────────────────────────────────────
echo "┄┄┄ Step 1/4: Installing upterm (terminal sharing tool) ┄┄┄"
if command -v upterm &>/dev/null; then
  echo "→ upterm already installed, skipping."
else
  echo "→ Generating SSH key..."
  echo "→ Downloading upterm binary..."
  (cd "$WORKSPACE" && bash install_upterm.sh)
  echo "✓ upterm installed."
fi

echo ""

# ── Step 2: Install chat app dependencies ──────────────────────────────────
echo "┄┄┄ Step 2/4: Installing chat app dependencies ┄┄┄"
echo "→ Running npm install (this may take a minute)..."
(cd "$WORKSPACE" && npm install --progress)
echo "✓ Chat app dependencies installed."

echo ""

# ── Step 3: Initialize git submodule ───────────────────────────────────────
echo "┄┄┄ Step 3/4: Initializing BusMgmt submodule ┄┄┄"
echo "→ Fetching submodule from GitHub..."
(cd "$WORKSPACE" && git submodule update --init --recursive --progress)
echo "✓ Submodule initialized."

echo ""

# ── Step 4: Install BusMgmt dependencies ───────────────────────────────────
echo "┄┄┄ Step 4/4: Installing BusMgmt dependencies ┄┄┄"
echo "→ Running npm install in integrations/BusMgmtBenchmarks (this may take a minute)..."
(cd "$WORKSPACE" && npm --prefix integrations/BusMgmtBenchmarks install --progress)
echo "✓ BusMgmt dependencies installed."

echo ""
echo "┌──────────────────────────────────────┐"
echo "│     ✓ Codespace setup complete!      │"
echo "└──────────────────────────────────────┘"
echo ""
echo "  Run 'bash start-dev.sh' to start the dev servers."
echo ""
