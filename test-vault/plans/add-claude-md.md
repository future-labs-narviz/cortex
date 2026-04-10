---
type: plan
title: "Add CLAUDE.md at repo root encoding Cortex project constraints"
status: complete
goal: "Create ~/Desktop/Cortex/CLAUDE.md so future Claude Code sessions opened in this repo auto-inherit the hard-won project rules (Safari 15 compat, Tauri gotchas, Phase B flag quirks, which test-vault notes to ignore, auth paths). File must follow the structure described in the body below, reference real file paths that exist in the repo, and be <= 250 lines."
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob"]
denied_tools: ["Bash(rm *)", "Bash(git push *)", "Bash(git commit *)"]
context_entities: []
context_notes:
  - "patterns/Pattern - Safari 15 Compatibility.md"
  - "patterns/Pattern - Parallel Agent Teams.md"
  - "patterns/Pattern - Self-Bootstrapping.md"
model: claude-sonnet-4-5
max_turns: 20
max_budget_usd: 2
permission_mode: acceptEdits
worktree: false
last_run_id: 828e24f5-f010-4470-9e5c-fce155863d61
last_run_at: 2026-04-10T14:32:23.363684+00:00
---

# Add CLAUDE.md at repo root

## Why this plan exists

Cortex is a Tauri 2 knowledge-graph desktop app with Phase A (auto-capture
interactive `claude` sessions) and Phase B (execute + draft plans via spawned
`claude`). Over the course of building Phase B, several **hard project
constraints** were discovered only after causing real bugs. These constraints
currently live in:

- `test-vault/patterns/` (vault content — not loaded by Claude Code automatically)
- `~/.claude/projects/-Users-jamq-Desktop-Cortex/memory/` (per-user memory — not shared)
- The heads of the people who've worked on the project

They need to live in a `CLAUDE.md` at the **repo root** so ANY Claude Code
session opened in this repo picks them up on session start.

Currently there is no CLAUDE.md anywhere in the repo.

## Exact scope

Create exactly one file: `~/Desktop/Cortex/CLAUDE.md` (committed — root of
the Cortex git repo, not inside `test-vault/`).

Do NOT create AGENTS.md or GEMINI.md. Do NOT modify any existing file.
Do NOT commit. (The human will review and commit manually.)

## Required sections (in this order)

### 1. One-paragraph "What is Cortex" lede
2-4 sentences describing Cortex as a Tauri knowledge-graph app that both
captures interactive `claude` sessions (Phase A) and spawns `claude` to
execute + draft plans (Phase B), backed by a typed KG maintained by
`cortex-extract` via Vertex AI.

### 2. Hard constraints (non-negotiable)

**Safari 15 WKWebView.** Tauri on macOS 12 uses Safari 15. Do NOT use:
- `oklch()` colors
- `color-mix()`
- **Tailwind v4 color utility classes** like `bg-red-500`, `text-blue-400` — they emit `oklch()` internally and cause blank pages
- Regex lookbehind `(?<=...)` or `(?<!...)`

Use instead:
- Inline `style={{}}` for all critical spacing
- CSS variables with **hex values only** (e.g. `var(--accent)` where `--accent: #3b82f6`)
- Lucide icons (SVG, always safe)
- Tailwind layout utilities (`flex`, `min-w-0`, `animate-spin`) — no color utilities

Reference implementation: `src/components/sidebar/SessionsPanel.tsx`.

**Phase B `claude` spawn flags.** Do NOT pass `--include-hook-events` to
spawned claude. It causes the child to exit immediately with 0 events under
Tauri shell spawn. Banned in `src-tauri/src/run/execute.rs::build_claude_args`
and `src-tauri/src/commands/plans.rs::draft_plan_from_goal`. A regression
test `build_args_does_not_include_hook_events_flag` guards this.

**Tauri GUI env is barebones.** macOS Finder/Dock launches start processes
with no shell exports — `/opt/homebrew/bin` and `/usr/local/bin` are missing.
When spawning any binary via `tauri_plugin_shell::Command::spawn()`, ALWAYS
extend PATH explicitly:
```rust
let current_path = std::env::var("PATH").unwrap_or_default();
let extended_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", current_path);
cmd.env("PATH", &extended_path).spawn()?;
```
Reference: `src-tauri/src/run/execute.rs` around line 70.

**Tauri shell permissions.** `shell:allow-execute` and `shell:allow-spawn` are
separate permissions in tauri-plugin-shell 2.x. Both must be declared in
`src-tauri/capabilities/default.json` with matching scope allowlists if your
code uses both `.execute()` and `.spawn()`. Phase B uses `.spawn()` — missing
the allow-spawn grant silently fails.

**`window.prompt/alert/confirm` do NOT work in Tauri webview.** Use inline
React input fields with `autoFocus`, Enter-to-submit, Escape-to-cancel.
Reference: `src/components/sidebar/PlansPanel.tsx` (the + New Plan and
✨ Draft Plan buttons).

**Vite dev watcher must ignore vault paths.** Phase A writes
`.claude/settings.json` on `open_vault`; `cortex-extract` writes
`.cortex/kg.json` after runs. Both trigger HMR reload loops in dev mode
unless `test-vault/`, `.cortex/`, `.claude/` are in the Vite watcher ignore
list. See `vite.config.ts`. Also see the content-equality guard in
`src-tauri/src/commands/vault.rs::write_claude_settings`.

### 3. The three LLM auth contexts (don't conflate them)

| Context | Auth | Where | Used for |
|---|---|---|---|
| Interactive Claude Code | Max plan OAuth keychain | User's terminal | Phase A hook capture loop |
| `cortex-extract` | Vertex AI via SA JSON in `~/Desktop/Cortex/.env` | Rust background task after session end | Retrospective generation + KG entity/relation extraction |
| Phase B `execute_plan` + `draft_plan_from_goal` | Max plan OAuth keychain | Spawned `claude --print --setting-sources user` via tauri-plugin-shell | Executing plans, drafting plans in plan mode |

**Vertex is NEVER used by Phase B.** Max plan OAuth is NEVER used by
`cortex-extract`. Don't wire them together.

### 4. Architecture at a glance

Rust workspace with 6 crates:
- `cortex` (src-tauri/src) — Tauri app, MCP server, Phase B run orchestrator
- `cortex-core` — Vault I/O, frontmatter parsing, file watcher
- `cortex-search` — Tantivy full-text search index
- `cortex-graph` — Link index, backlinks, wikilinks parser
- `cortex-kg` — Typed knowledge graph (entities, relations, subgraph queries)
- `cortex-voice` — Audio recording + transcription (extracted from Handy)
- `cortex-extract` — Post-session Vertex AI extraction → KG writeback + retrospective

Frontend: React 18 + TypeScript, CodeMirror 6 editor, D3 graph view,
Zustand stores (`layoutStore`, `vaultStore`, `runStore`, etc.), inline-style
discipline per Safari 15 rule above.

MCP HTTP server on `127.0.0.1:3847` exposes `cortex_*` tools to spawned
claude (both Phase A and Phase B) via per-run `.mcp.json`.

Key Phase B files:
- `src-tauri/src/run/prepare.rs` — plan frontmatter parsing, RunSpec assembly, KG context bundle, session note pre-write
- `src-tauri/src/run/execute.rs` — spawn claude, stream-json event loop, Tauri event emission, extraction trigger, plan-note status writeback
- `src-tauri/src/commands/plans.rs` — `list_plan_notes`, `create_plan_note`, `draft_plan_from_goal`, `load_run_transcript`
- `src/components/session/LiveSessionView.tsx` — live transcript view (also handles JSONL replay)
- `src/components/plan/PlanRunnerView.tsx` — plan viewer + inline frontmatter editor
- `src/components/sidebar/PlansPanel.tsx` — Plans sidebar with + New and ✨ Draft buttons
- `src/stores/runStore.ts` — Zustand store for live + replayed run state

### 5. Development pattern

Parallel-teams + file-disjoint is the project's canonical workflow. Teams
own specific file sets, shared types are defined before spawning teams,
`cargo check --workspace` + `bun run build` between every wave. See
`test-vault/patterns/Pattern - Parallel Agent Teams.md` for the full pattern.
When implementing a multi-step feature, consider writing plans (as Phase B
plan notes) for each sub-task so fresh sessions can pick them up — the
Self-Bootstrapping pattern.

### 6. Ignore list (content in the repo that is NOT Cortex)

The `test-vault/` directory is the committed sample vault for testing
Cortex itself. Some of its content is **demo / fictional and unrelated to
the Cortex codebase**:
- `test-vault/projects/Auth Module.md` — fictional sample project
- `test-vault/projects/Payment System.md` — fictional sample project
- `test-vault/decisions/Decision - JWT vs Sessions.md` — about the fictional Auth Module
- `test-vault/daily/*.md` — fictional daily logs

When doing Cortex work, **do not treat these as real requirements or
constraints**. They exist to demo the multi-project vault workflow.

The following test-vault content IS real Cortex project knowledge and
should be referenced:
- `test-vault/patterns/Pattern - Safari 15 Compatibility.md`
- `test-vault/patterns/Pattern - Parallel Agent Teams.md`
- `test-vault/patterns/Pattern - MCP as Integration Layer.md`
- `test-vault/patterns/Pattern - Self-Bootstrapping.md`
- `test-vault/Architecture Overview.md`
- `test-vault/MCP Integration Guide.md`
- `test-vault/Claude Code Source Analysis.md`
- `test-vault/decisions/Decision - {Tauri vs Electron, Tantivy vs Meilisearch, MCP vs Custom API, CodeMirror vs ProseMirror}.md`
- `test-vault/sessions/2026-04-08_wave*-*.md` — the original Cortex build narrative

### 7. Common commands

```bash
# Dev
cd ~/Desktop/Cortex && bun run tauri dev

# Type check + build (both halves)
cd ~/Desktop/Cortex/src-tauri && cargo check --workspace
cd ~/Desktop/Cortex && bun run build

# Full test suite
cd ~/Desktop/Cortex/src-tauri && cargo test --workspace

# Production build (untested as of this writing)
cd ~/Desktop/Cortex && bun run tauri build
```

## Verification before reporting DONE

1. File exists at `~/Desktop/Cortex/CLAUDE.md`
2. Contains all 7 sections above
3. `<= 250 lines` (`wc -l CLAUDE.md`)
4. All file paths mentioned exist: verify each with `ls` or `Read`
5. No oklch / color-mix / window.prompt examples as "do this" — only as "don't do this"
6. `cargo check --workspace` still passes (sanity that you didn't edit anything else)
7. `bun run build` still passes

Report DONE with: file path, line count, and a one-line summary of
which sections you included.
