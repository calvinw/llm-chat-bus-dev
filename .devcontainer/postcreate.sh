#!/bin/bash
# postcreate.sh — runs once when the Codespace container is first created

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

echo ""
echo "┌──────────────────────────────────────┐"
echo "│     Codespace Setup                  │"
echo "└──────────────────────────────────────┘"
echo ""

# Install upterm (terminal sharing)
if command -v upterm &>/dev/null; then
  echo "→ upterm already installed, skipping."
else
  echo "→ Installing upterm..."
  (cd "$WORKSPACE" && bash install_upterm.sh)
  echo "✓ upterm installed."
fi

echo ""

# Install root npm dependencies
echo "→ Installing root npm dependencies..."
(cd "$WORKSPACE" && npm install)
echo "✓ Root dependencies installed."

echo ""

# Init git submodule and install BusMgmt dependencies
echo "→ Setting up BusMgmt integration (submodule + dependencies)..."
(cd "$WORKSPACE" && npm run setup:integration)
echo "✓ Integration setup complete."

echo ""

# Set up dev server auto-start hook in ~/.bashrc
echo "→ Setting up dev server hook..."
bash "$WORKSPACE/.devcontainer/setup.sh"

echo ""
echo "✓ Codespace setup complete."
echo "  Open a terminal to start the dev servers."
echo ""
