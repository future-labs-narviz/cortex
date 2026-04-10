# Cortex Project Instructions

Cortex is a Tauri 2.x desktop app (Rust + React + TypeScript) that provides knowledge graph-powered note-taking with AI-assisted planning. This file encodes hard-won constraints that future Claude Code sessions must follow.

## Project Structure

- `src-tauri/` — Rust backend (Tauri commands, MCP server, KG extraction)
- `src/components/` — React frontend components
- `cortex-extract/` — Standalone KG extraction binary (Vertex AI)
- `test-vault/` — Test notes (patterns/ = docs, sessions/ = auto-generated)
- Key files: `vite.config.ts`, `src-tauri/capabilities/default.json`

---

## CRITICAL: Safari 15 Compatibility (macOS 12 WKWebView)

Tauri on macOS 12 uses Safari 15's WKWebView. Modern CSS features cause **blank pages**.

### DO NOT USE in any frontend code:
- `oklch()` colors — NOT supported
- `color-mix()` — NOT supported  
- **Tailwind v4 color utility classes** (`bg-red-500`, `text-blue-400`, etc.) — emit `oklch()` internally
- Regex lookbehind `(?<=...)` or `(?<!...)` — NOT supported

### DO USE:
- Inline `style={{ padding: 16, marginBottom: 20 }}` for spacing
- CSS variables with **hex values only**: `var(--accent)` where `--accent: #3b82f6`
- Lucide icons (pure SVG, always safe)
- Tailwind layout utilities: `flex`, `flex-col`, `min-w-0`, `overflow-*`, `gap-*` (anything non-color)
- Hex colors for specific shades: `color: "#ef4444"` NOT `color: "red-500"`

**Verify:** `grep -rn oklch src/` must stay empty.

**Reference implementations:**
- `src/components/sidebar/SessionsPanel.tsx`
- `src/components/sidebar/PlansPanel.tsx`
- `src/components/sidebar/LiveSessionView.tsx`

**Why:** Discovered during UI polish — whole pages went blank. Documented in `test-vault/patterns/Pattern - Safari 15 Compatibility.md`.

---

## Tauri v2 Gotchas

### 1. GUI-Launched Apps Have Barebones PATH

macOS Finder/Dock launches don't inherit shell PATH. `/opt/homebrew/bin`, `/usr/local/bin`, `$HOME/.local/bin` are missing.

**Fix (required for all spawns):**
```rust
let current_path = std::env::var("PATH").unwrap_or_default();
let extended_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", current_path);
shell.command("claude")
    .env("PATH", &extended_path)  // Always extend PATH
    .spawn()?;
```

**Reference:** `src-tauri/src/run/execute.rs`

### 2. Shell Spawn Requires TWO Permission Types

`tauri-plugin-shell` 2.x needs BOTH:
- `shell:allow-execute` — for `.execute()` 
- `shell:allow-spawn` — for `.spawn()`

Plus `shell:allow-kill` and `shell:allow-stdin-write` as needed.

**Reference:** `src-tauri/capabilities/default.json`

### 3. window.prompt/alert/confirm Don't Work

WKWebView blocks legacy browser dialogs. They return null or no-op.

**Use instead:** React state + inline input fields with `autoFocus`, Enter-to-submit, Escape-to-cancel.

**Reference:** `src/components/sidebar/PlansPanel.tsx` (+ New Plan and ✨ Draft Plan buttons)

### 4. Vite HMR Must Ignore Vault Paths

Backend writes to `.claude/settings.json`, `.cortex/kg.json` trigger infinite reload loops.

**Required in `vite.config.ts`:**
```ts
server: {
  watch: {
    ignored: [
      '**/test-vault/**',
      '**/.cortex/**', 
      '**/.claude/**',
      '**/vault/**',
      '**/node_modules/**',
      '**/.git/**'
    ],
  }
}
```

**Plus content-equality guard in writers:** Check if existing file content matches before writing.

---

## Phase B (Plan Execution) Rules

### Auth Strategy

Phase B spawns **Max-plan Claude Code sessions** via `--setting-sources user`, NOT Vertex AI.

**Correct spawn command:**
```bash
claude --print --verbose \
  --setting-sources user \
  --strict-mcp-config --mcp-config <path> \
  # ... other flags
```

**Why:** User has Max plan (unlimited). `--setting-sources user` loads user-level settings (`~/.claude/settings.json` with OAuth) but skips project-level hooks (`<vault>/.claude/settings.json`) to avoid recursion.

**Do NOT use:**
- `--bare` — kills OAuth/Max plan auth
- Vertex env translation — unnecessary for spawned claude processes

### DO NOT Use --include-hook-events Flag

This flag causes `claude --print --output-format stream-json` to exit immediately with 0 events under Tauri shell spawn.

**Why:** Unknown root cause. Flag validates fine but breaks every spawn. Fixed in commit `69cacb0`.

**Where to check:** `src-tauri/src/run/execute.rs::build_claude_args`

A regression guard `build_args_does_not_include_hook_events_flag` in the test suite will fail loudly if this flag is re-added.

### Phase B Self-Modification Rule (READ THIS BEFORE WRITING CORTEX PLANS)

**Phase B is NOT safe for executing plans that modify Cortex itself while the Cortex dev app is running.** This is an undocumented boundary of what Phase B was designed for, and violating it produces several interacting failure modes:

1. **The build paradox.** Plans that run `bun run tauri build` or `bun run tauri dev` recompile the binary that the Phase B `run_event_loop` task is currently executing inside. The tauri process gets replaced mid-run, the event loop task is dropped, the session note is orphaned (stuck in `status: running` forever — `sweep_orphan_sessions` on next vault open now transitions these to `aborted`). Observed real failure: the first attempt at `plans/verify-production-build.md` (run `6071c0ad-…` on 2026-04-10) orphaned exactly this way.

2. **The feedback-loop paradox.** Plans that add Phase B features (e.g. `abort_draft`, `live-drafting-view`) are asking the agent to build the thing that would cancel or modify the very run it's in. The code exists, but the running binary is the OLD compiled version, so testing the change requires restarting — which kills the agent. Classic self-modification deadlock.

3. **Interactive skills in autonomous mode.** Under `--setting-sources user`, spawned claude inherits user-level plugins including `superpowers:brainstorming` and similar skills that default to "ask the user before implementing." Phase B is headless (`--print` mode, no stdin) — there is no user to answer. The agent asks a question into the void, hits max_turns or concludes the question is its deliverable, and exits `status: success` with zero code changes. Observed real failure: `plans/add-abort-draft.md` run `f72f55ac-…` spent 21 turns exploring, invoked a Skill, asked for clarification, and did no work.

**How to identify a Cortex self-modifying plan:**
- Touches any file under `src-tauri/` (Rust backend)
- Touches any file under `src/` (frontend)
- Runs `cargo build`, `cargo check`, `bun run build`, `bun run tauri *`
- Modifies `CLAUDE.md`, `tauri.conf.json`, `vite.config.ts`, `capabilities/*.json`
- Modifies any file under `test-vault/.cortex/`, `test-vault/.claude/`, or the gitignored `/.claude/`

**How to execute Cortex self-modifying plans (pick one):**

**Option A — External Claude Code session (canonical, do this today):** Quit Cortex or leave it running (doesn't matter). Open a terminal, `cd ~/Desktop/Cortex`, run `claude`. Paste or reference the plan body. Phase A auto-capture still records the session (retrospective + KG growth happen via the hook loop). You get an interactive feedback channel so skills that ask questions work correctly. The terminal claude doesn't share process state with the running Cortex, so the self-modification paradox is impossible.

**Option B — Git worktree isolation (future work, not yet implemented):** Phase B would detect "self-modifying" plans and automatically create a git worktree at `/tmp/cortex-worktree-<run_id>/`, spawn claude with `cwd` set there, let it work, and surface the worktree diff for manual review + merge. The currently-running Cortex instance is never touched during execution. This is a Phase B v2 feature — not available yet.

**For all Cortex self-modifying plans, the frontmatter should include:**

```yaml
# Block interactive skills that assume a human is in the loop.
denied_tools: ["Skill", "Bash(rm *)", "Bash(git push *)"]
```

And the body should have an **Autonomous execution** stanza at the top:

> **This is autonomous execution.** There is no human to ask during this run. Do NOT invoke brainstorming, planning, or any interactive skills. Do NOT use the `Skill` tool. Make decisions yourself based on the spec below. If you encounter an ambiguity the spec doesn't cover, pick the most conservative option and document the decision in your final report. Implement all changes in this session; do not defer work to "next steps" or "follow-up sessions".

**When in doubt:** if the plan touches any code file in `src-tauri/` or `src/`, execute it from an external terminal `claude` session, NOT from inside Cortex Phase B.

---

## Cortex's Three LLM Contexts (Do Not Conflate)

1. **Interactive Claude Code (Max plan OAuth)** — user runs directly, calls Cortex MCP server
2. **`cortex-extract` background job (Vertex AI)** — standalone KG extraction after session ends
3. **Phase B spawned Claude Code (Max plan OAuth)** — orchestrator launches plan execution

### Vertex AI Auth (cortex-extract ONLY)

**Env vars (load from `~/Desktop/Cortex/.env` via `dotenvy` at startup):**
- `GCP_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GCP_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT_ID` (verified: `admachina-atomic-test-84`)
- `GCP_REGION` (default: `global`, verified: `global` and `us-east5`)

**Endpoint:**
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/anthropic/models/{model_id}:rawPredict
```
(If `region == "global"`, drop the `{region}-` prefix)

**Body:** Standard Anthropic Messages API, but:
- **Omit** `model` field (it's in URL)
- **Add** `"anthropic_version": "vertex-2023-10-16"`

**Auth:** `gcp_auth::AuthenticationManager::get_token()`, pass as `Authorization: Bearer <token>`

**Model IDs (verified working 2026-04-09):**
- `claude-haiku-4-5@20251001` — fast, use for cortex-extract
- `claude-sonnet-4-5@20250929` — balanced
- `claude-opus-4-6` — powerful

**Structured output:** Vertex Anthropic does NOT support native structured output. Use forced `tool_use` with `tool_choice: {type: "tool", name: "..."}`.

**Do NOT:**
- Shell out to `claude --bare -p` for Cortex LLM calls
- Call `api.anthropic.com` — user's Anthropic account has zero credit balance

**Reference implementation:** `~/Desktop/future-stuff/future-labs/lib/agent/provider/registry.ts`

---

## UI Design Rules

**DO:** Study real apps (Obsidian, Linear) before writing CSS. Go component-by-component. Add depth (shadows, hierarchy). Ensure text never touches edges.  
**DON'T:** Playwright screenshot loops, incremental padding tweaks without understanding structural issues.  
**Fix:** Text crammed at edges, no visual depth, wrong section title sizes, buttons with no inner margin.

---

## test-vault/ Notes

**DO use:** `test-vault/patterns/` — curated docs (Safari 15 Compatibility, Parallel Agent Teams, Self-Bootstrapping)  
**DO NOT use:** `test-vault/sessions/` — auto-captured during dev, messy/incomplete

---

## Development Workflow

**Build:** `bun run tauri dev` (full stack), `bun run dev` (frontend only)  
**Gate checks:** `cargo check --manifest-path src-tauri/Cargo.toml && bun run build`

---

## MCP Server

Cortex runs its own MCP server with tools: `cortex/search`, `cortex/get-note`, `cortex/entity-profile`, `cortex/query-graph`, etc. Phase B spawns get restricted MCP via `--strict-mcp-config`.

---

## File Paths Quick Reference

### Frontend Components
- Sidebar panels: `src/components/sidebar/`
- Main views: `src/components/`

### Backend Commands
- Vault ops: `src-tauri/src/commands/vault.rs`
- Plan execution: `src-tauri/src/run/execute.rs`
- Plan commands: `src-tauri/src/commands/plans.rs`
- Session capture: `src-tauri/src/commands/sessions.rs`

### Configuration
- Tauri permissions: `src-tauri/capabilities/default.json`
- Vite config: `vite.config.ts`
- Environment: `~/Desktop/Cortex/.env` (loaded via `dotenvy`)

### Documentation
- This file: `CLAUDE.md`
- Project patterns: `test-vault/patterns/Pattern - *.md`
- Auto-captured sessions: `test-vault/sessions/` (noisy, use with caution)

---

## When In Doubt

1. Check existing implementations in the same category
2. Read the relevant `test-vault/patterns/` note if one exists  
3. Verify Safari 15 compat before writing frontend code
4. Run `cargo check` + `bun run build` before claiming "it works"
5. Never bypass Tauri security (don't add blanket shell permissions)
