# BusMgmt Integration Plan (Primary Repo: llm-chat-bus-dev)

## Goal
Make `llm-chat-bus-dev` the primary development repo for the LLM wrapper and integrate the real BusMgmt app via git submodule, replacing the mock iframe page.

## Desired End State
- Working integration code already exists in `/Users/calvinw/develop/BusMgmtBenchmarks-dev` (bridge + wrapper workflow), and should be treated as the current reference implementation while migrating to `llm-chat-bus-dev`.
- Wrapper development happens in `llm-chat-bus-dev`.
- `BusMgmtBenchmarks` is added as a submodule inside `llm-chat-bus-dev`.
- Wrapper iframe points at the real BusMgmt app (local dev + deploy output).
- `company-to-company` mock page is removed once integration is stable.
- GitHub Pages testing happens from `llm-chat-bus-dev` `docs/` output.
- `BusMgmtBenchmarks/main` remains production-safe (no direct pushes from automation).

## Branch Strategy
- `llm-chat-bus-dev`:
  - Use a feature branch for submodule integration work.
  - Merge to `main` only when GitHub Pages output is validated.
- `BusMgmtBenchmarks` submodule:
  - Initially pin to `main`.
  - If app-side changes are needed, use short-lived feature branches there.

## Implementation Steps
1. Add submodule in `llm-chat-bus-dev`.
   - Suggested path: `integrations/BusMgmtBenchmarks`.
2. Update wrapper config so iframe source is environment-driven:
   - Local dev default: `http://localhost:3000/company_to_company.html`.
   - Production default: bundled/deployed path inside wrapper site.
3. Add a build/sync step in `llm-chat-bus-dev` that copies required BusMgmt static assets/pages from submodule into wrapper deploy output.
4. Keep `postMessage` bridge as primary integration channel.
   - Keep direct DOM access only as fallback during transition.
5. Remove mock `company-to-company.html` in wrapper repo after verified parity.
6. Validate end-to-end locally:
   - Run BusMgmt dev server.
   - Run wrapper dev server.
   - Verify selection + financial data tools and no iframe recursion.
7. Build and verify static output:
   - Confirm `docs/` contains wrapper + BusMgmt page/assets.
   - Smoke-test locally via preview before pushing.

## Local Dev Workflow
- Terminal A (`llm-chat-bus-dev`): run wrapper dev.
- Terminal B (`integrations/BusMgmtBenchmarks`): run BusMgmt dev.
- Commit order when both repos change:
  1. Commit/push in BusMgmt submodule repo.
  2. Commit/push updated submodule pointer in wrapper repo.

## Deploy Workflow (GitHub Pages)
- Pages will only change when wrapper repo `docs/` artifacts are committed and pushed to its configured branch.
- Before pushing deploy commits:
  - Run integration smoke test.
  - Run build and preview.
  - Confirm iframe URL/path resolves correctly in built site.

## Team Safety Rules
- No direct automation pushes to `BusMgmtBenchmarks/main`.
- Use PR-based merge policy where possible.
- Keep submodule pointer updates explicit and reviewable.

## First Session Checklist
1. Create integration branch in `llm-chat-bus-dev`.
2. Add `BusMgmtBenchmarks` submodule.
3. Add/update dev + build scripts for dual-server and sync pipeline.
4. Wire iframe defaults for local/prod paths.
5. Run end-to-end local test.
6. Decide mock page removal point.
