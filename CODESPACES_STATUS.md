# Codespaces Setup Status

## What was set up

Six files were added to support GitHub Codespaces:

```
.devcontainer/devcontainer.json   — forwards ports 8081 (chat) + 3000 (BusMgmt)
.devcontainer/postcreate.sh       — runs on container creation: installs upterm, npm install, setup:integration, adds bashrc hook
.devcontainer/setup.sh            — adds bashrc hook to auto-run start-dev.sh on first terminal open
install_upterm.sh                 — cross-platform upterm installer
setup_agent_tool.sh               — interactive menu to install Claude Code / Opencode / Gemini / Codex
start-dev.sh                      — starts BusMgmt on :3000, waits, then starts chat wrapper on :8081
```

On first terminal open, `start-dev.sh` runs automatically and starts both servers in the background.

## Current situation

**Port 8081 (chat app):** Working.

**Port 3000 (BusMgmt submodule):** Working.

## What was fixed

### Iframe URL not resolving in Codespaces (`src/ChatApp.jsx`)

In Codespaces, the browser connects to the app via a forwarded hostname
(e.g. `https://[name]-8081.app.github.dev`). The iframe was hardcoded to
`http://localhost:3000/...`, which the browser resolves against the user's
local machine — not the Codespace container.

**Fix:** At runtime, detect if `window.location.hostname` ends with
`.app.github.dev` and swap the port in the hostname to derive the BusMgmt URL:

```
https://[name]-8081.app.github.dev  →  https://[name]-3000.app.github.dev
```

Also translates any stale `localhost:3000` URL saved in `localStorage` so
existing sessions aren't broken. Falls back to `localhost:3000` in all
non-Codespaces environments.

### allowedHosts blocking Vite (`integrations/BusMgmtBenchmarks/vite.config.ts`)

Vite 5+ blocks requests from hosts not in an explicit `allowedHosts` list.
Added `.app.github.dev` to `allowedHosts`, plus `host: true` and
`hmr.clientPort: 443` for correct Codespaces HMR behaviour. This fix was
pushed to the BusMgmtBenchmarks submodule repo and the parent pointer updated.

Same fix applied to the main app's `vite.config.js`.
