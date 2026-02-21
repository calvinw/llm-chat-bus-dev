#!/bin/bash
# Appends dev-server auto-start hook to ~/.bashrc (only once per container creation)

if ! grep -qF 'start-dev.sh' ~/.bashrc; then
  cat >> ~/.bashrc << 'BASHRC'

# Auto-start dev servers on first terminal open
_WORKSPACE="${CODESPACE_VSCODE_FOLDER:-/workspaces/llm-chat-bus-dev}"
if ! ss -tln 2>/dev/null | grep -q ':8081 ' && \
   [ -f "${_WORKSPACE}/start-dev.sh" ]; then
  bash "${_WORKSPACE}/start-dev.sh"
fi
unset _WORKSPACE
BASHRC
  echo "Dev server hook added to ~/.bashrc"
fi
