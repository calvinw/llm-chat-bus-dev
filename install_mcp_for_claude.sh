#!/bin/bash
# MCP Servers - Claude Code Registration
# Registers HTTP-based MCP servers with Claude Code

# Remove existing servers if present
claude mcp remove shadcn 2>/dev/null || true
claude mcp remove ai-elements 2>/dev/null || true

# Add shadcn MCP server (HTTP transport)
claude mcp add --transport http shadcn https://gitmcp.io/shadcn/ui

# Add ai-elements MCP server (HTTP transport)
claude mcp add --transport http ai-elements https://registry.ai-sdk.dev/api/mcp
