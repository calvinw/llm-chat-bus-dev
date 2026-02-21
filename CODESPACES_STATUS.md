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

**Port 3000 (BusMgmt submodule):** Not working — exact cause unknown.

## What has been tried

1. Added `.app.github.dev` to `allowedHosts` in `integrations/BusMgmtBenchmarks/vite.config.ts`
   — Vite 5+ blocks requests from hosts not in an explicit allowedHosts list.
   — This fix was pushed to the BusMgmtBenchmarks submodule repo and the parent pointer updated.

2. Added `host: true`, `allowedHosts`, and `hmr.clientPort: 443` to the main app's `vite.config.js`
   — Same issue would affect port 8081 without this fix.

3. Made `start-dev.sh` more robust:
   - Checks if submodule is initialized (runs `git submodule update --init --recursive` if not)
   - Checks if BusMgmt `node_modules` exist (runs `npm install` if not)
   - Added a 60-second timeout on the BusMgmt wait loop so the chat app always starts even if BusMgmt fails

## What to investigate

Run this first to see the actual BusMgmt server output:

```bash
cat ~/.busmgmt-server.log
```

Then pull the latest fixes and restart both servers:

```bash
git pull
bash start-dev.sh
```

## Likely causes if BusMgmt still fails

- **Submodule not initialized**: `integrations/BusMgmtBenchmarks/` is empty or missing `node_modules`. The updated `start-dev.sh` guards against this.
- **allowedHosts still blocking**: If the submodule was checked out before the fix was pushed, the old `vite.config.ts` without `.app.github.dev` would still be in use. `git pull` + `bash start-dev.sh` should resolve this since the script now re-checks the submodule state.
- **Something else in the log**: The `cat ~/.busmgmt-server.log` output will show the real error.
