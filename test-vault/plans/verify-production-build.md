---
type: plan
title: "Verify Cortex production build (bun run tauri build) and fix what breaks"
status: ready
goal: "Run `bun run tauri build` end-to-end. Fix any errors that prevent it from producing a valid .app bundle. Then verify the built .app can be launched from Finder, open the test-vault, and successfully execute the fixture plan `plans/2026-04-09-add-readme.md`. Report all issues encountered and how each was resolved."
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash(bun *)", "Bash(cargo *)", "Bash(ls *)", "Bash(file *)", "Bash(stat *)", "Bash(open *)", "Bash(find *)", "Bash(du *)", "Bash(ps *)", "Bash(kill *)", "Bash(tail *)", "Bash(mkdir *)", "Bash(cp *)", "Bash(chmod *)"]
denied_tools: ["Bash(rm -rf /*)", "Bash(git push *)", "Bash(git commit *)", "Bash(sudo *)"]
context_entities: []
context_notes: []
model: claude-sonnet-4-5
max_turns: 30
max_budget_usd: 5
permission_mode: acceptEdits
worktree: false
---

# Verify Cortex production build

## Why this plan exists

`bun run tauri dev` is verified and works end-to-end. But `bun run tauri build`
has **never been run** in this project. It may fail on:
- Missing code-signing config
- Icon assets
- Release-profile cargo errors that dev builds tolerate
- Tauri bundler config gaps
- Huge frontend bundle (the last build warned the main index.js is ~1.94MB)
- Tauri v2 bundle identifier issues
- Permissions in capabilities/*.json not passing the production builder

Shipping Cortex to another machine as an installable `.app` is blocked until
the production build path works. This plan takes it from "never tried" to
"verified working" and documents any fixes needed.

**Critical**: this plan runs a lot of `Bash` commands. All are scoped to
build-related operations. The `denied_tools` block includes `Bash(rm -rf /*)`
and `Bash(sudo *)` as hard safety rails.

## Preconditions

Before starting, verify:
```bash
cd ~/Desktop/Cortex && git status
```
Working tree should be clean (or have only expected diffs). If dirty with
uncommitted changes, warn the human and stop.

## Task sequence

### Phase 1 — Inspect current state

1. `Read src-tauri/tauri.conf.json` — confirm `productName`, `version`,
   `identifier`, `bundle` settings are present
2. `ls src-tauri/icons/` — confirm PNG + ICNS icons exist
3. `Read package.json` — confirm `scripts.tauri` is wired
4. `Read src-tauri/Cargo.toml` — note the package metadata
5. Record what you see for the report.

### Phase 2 — First production build attempt

1. Run `bun run tauri build 2>&1 | tee /tmp/cortex-build.log`
2. If it succeeds on the first try:
   - Skip to Phase 3
3. If it fails:
   - Read `/tmp/cortex-build.log` and identify the exact error
   - Categorize: cargo compile error, Tauri bundle error, icon error,
     identifier error, signing error, or bundle-size error
   - Fix the smallest, most targeted change for each error
   - Re-run the build
   - Repeat until success OR you've hit 5 retries (then STOP and report)

**Allowed fixes during this phase:**
- Add/update `src-tauri/tauri.conf.json` bundle settings
- Add missing icons if the bundler needs specific sizes
- Set `bundle.identifier` to `com.cortex.app` if missing or placeholder
- Disable code signing explicitly in tauri.conf.json (`"codeSign": false` or equivalent v2 setting) — for this verification pass, unsigned .app is fine
- Fix any cargo release-profile errors that only appear in `--release`
- Add `"bundle": { "active": true, "targets": ["app"] }` to only build the
  .app bundle, not DMG/etc. (keeps the build fast and focused)
- Add `build.chunkSizeWarningLimit` to vite.config.ts if the bundle size
  warning becomes a hard error (unlikely, but allowed)

**NOT allowed fixes during this phase:**
- Adding or removing any Rust dependencies in Cargo.toml beyond what the
  builder explicitly demands
- Removing any Phase B feature code
- Changing anything outside `src-tauri/tauri.conf.json`, `src-tauri/icons/`,
  `src-tauri/Cargo.toml` (metadata only), `vite.config.ts` (chunk limit only),
  and `package.json` (scripts only)
- Modifying `.gitignore`
- Committing anything

If a needed fix is outside the allowed scope, STOP and report the issue
without fixing it.

### Phase 3 — Locate the built artifact

1. `find src-tauri/target/release -name "*.app" -type d | head -5`
2. `du -sh <found .app>`
3. Record the path and size
4. `ls <app>/Contents/MacOS/` — confirm the main binary is there

### Phase 4 — Smoke-test the built app

1. Open the built .app from Finder: `open <path-to-.app>`
2. Wait ~5 seconds
3. Verify the process is running: `ps aux | grep -i cortex | grep -v grep`
4. If the app crashed immediately, check the crash log:
   `ls -lt ~/Library/Logs/DiagnosticReports/ | head -5`
   and read the most recent report matching "cortex"
5. If the app runs, document it as PASSED for phase 4.

### Phase 5 — Functional smoke test in the built app

Open the .app is phase 4's responsibility. Automating GUI interaction
from a `claude --print` session is not possible — instead, verify the
"backend half" of Phase B works in production:

1. `curl -s http://127.0.0.1:3847/mcp -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → should return JSON with cortex_* tools. This proves the MCP server bound correctly in the production binary.
2. Record the response.
3. Verify the app is still running after 30 seconds (not crashing silently).

Note: the full Phase B execute flow requires clicking a button in the GUI,
which you can't do. The human will verify that manually after you report.
Your job is just to prove the production binary is STABLE and the MCP
server is REACHABLE from a release build.

### Phase 6 — Cleanup

1. Kill any running Cortex .app processes you launched: `pkill -f "cortex"`
   or similar. Be specific — do NOT kill the dev instance if one is running.
2. Leave the .app bundle in place (the human may want to install it).
3. Restore any temporary vite.config.ts or tauri.conf.json changes if they
   were only meant for the build verification. Re-verify `bun run tauri dev`
   still works: `timeout 30 bun run tauri dev 2>&1 | head -30` (check for
   compile success, don't wait for the window to actually launch — it will
   fail to open one in a subagent context, that's fine as long as the build
   succeeds).

## Verification

1. A `.app` bundle exists in `src-tauri/target/release/bundle/macos/` (or
   wherever the bundler wrote it)
2. `open <path>` launches the app without an immediate crash
3. MCP server responds on port 3847 from the production binary
4. `bun run tauri dev` still compiles cleanly
5. `cargo check --workspace` still passes
6. Working tree changes are minimal — only tauri.conf.json / icons / vite
   config should be modified, if anything

## Report format

End with a structured summary:

```
PRODUCTION BUILD STATUS: PASS | PARTIAL | FAIL

Fixes applied:
- <fix 1 with file path + one-line reason>
- <fix 2 ...>
- (or "none — built clean on first attempt")

Artifact:
- Path: <.app path>
- Size: <size>

Smoke test:
- App launched from Finder: YES/NO
- MCP server reachable on port 3847: YES/NO
- MCP tools list count: <N>

Remaining blockers (if any):
- <description>

Next manual step for the human:
- <e.g., "Open the .app, Cmd+O the test-vault, click the fixture plan's Execute button, verify the live session view renders">
```
