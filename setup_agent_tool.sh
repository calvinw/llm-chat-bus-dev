#!/bin/bash
# setup_agent_tool.sh — install your AI coding assistant

echo ""
echo "┌──────────────────────────────────────┐"
echo "│   Install AI Coding Assistant        │"
echo "└──────────────────────────────────────┘"
echo ""
echo "Which AI coding tool would you like to install?"
echo ""
echo "  1) Claude Code"
echo "  2) Opencode"
echo "  3) Gemini CLI"
echo "  4) Codex CLI"
echo ""
read -rp "Enter number [1-4]: " choice

case "$choice" in
  1)
    echo ""
    echo "→ Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
    ;;
  2)
    echo ""
    echo "→ Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
    ;;
  3)
    echo ""
    echo "→ Installing Gemini CLI..."
    npm install -g @google/gemini-cli
    ;;
  4)
    echo ""
    echo "→ Installing Codex CLI..."
    npm install -g @openai/codex
    ;;
  *)
    echo "Invalid choice. Run 'bash setup_agent_tool.sh' to try again."
    exit 1
    ;;
esac

echo ""
echo "✓ Done! Follow any authentication prompts above to get started."
echo ""
