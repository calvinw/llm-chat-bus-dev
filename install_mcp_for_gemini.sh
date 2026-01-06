#!/bin/bash
# FL Studio MCP - Gemini CLI Registration
# Registers the MCP server with Gemini CLI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"
SERVER_SCRIPT="$SCRIPT_DIR/fl_studio_mcp_server.py"

gemini mcp remove fl-studio-mcp 2>/dev/null || true
gemini mcp add fl-studio-mcp "$VENV_PYTHON" "$SERVER_SCRIPT"