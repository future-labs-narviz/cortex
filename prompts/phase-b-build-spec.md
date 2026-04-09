# Cortex Phase B — Plan Execution Build Spec

This is the build spec for Phase B: the orchestrator layer that turns a `type: plan` markdown note into a live, executing Claude Code session, with KG-driven context injection, streaming transcript display, and automatic post-run extraction.

Phase A shipped on 2026-04-09 (commits `8afa515` + `c0a8823`). Phase B builds the *other* direction of the loop: not just capturing what Claude Code did, but **launching** Claude Code from Cortex with curated context.

## Inputs (read in this order)

1. **`prompts/phase-b-verified-state.md` (v2)** — current source of truth. The "Hard gate" command, the spawn template, the stream-json event taxonomy, the `--setting-sources user` decision, and the auth strategy (Max plan now, custom Vertex harness later) are all canonical here. **Read this end to end before writing any code.**
2. **`prompts/session-1-output.md` §3.1, §3.2, §3.6, §4** — original Phase B architecture from the research session. The `type: plan` frontmatter schema, the plan-to-execution pipeline ASCII diagram, and the new sheet kinds. The verified state doc supersedes the auth section but the architecture stands.
3. **`~/.claude/projects/-Users-jamq-Desktop-Cortex/memory/project_phase_b_auth_strategy.md`** — codifies the Max-plan-vs-Vertex decision and the three-LLM-context model. Non-negotiable.
4. **The Cortex codebase**, especially:
   - `src-tauri/src/lib.rs` — Tauri command registration
   - `src-tauri/src/commands/vault.rs` — vault open flow (Phase A's settings.json writer lives here)
   - `src-tauri/src/state.rs` — `AppState` shape
   - `src-tauri/crates/cortex-kg/src/graph.rs` — `serialize_subgraph`, `nearby_for_cwd` (Phase A added the latter)
   - `src-tauri/crates/cortex-extract/src/extract.rs` — `extraction_job` signature (Phase B calls it directly)
   - `src-tauri/crates/cortex-extract/src/transcript.rs` — JSONL parser (Phase B may stream into a similar in-memory builder)
   - `src/lib/types/index.ts`, `src/lib/types/layout.ts` — `SidebarPanel`, `SheetContent` unions
   - `src/components/layout/Sheet.tsx` — sheet content router
   - `src/components/layout/Sidebar.tsx` — sidebar nav rail
   - `src/stores/layoutStore.ts` — sheet store

## Operating mode

**Build mode, not plan mode.** The verification spike is done. The architecture is locked. The auth path is locked. This spec defines the WHAT and the WHERE; the build session executes it.

Do not enter plan mode unless an item's specifics turn out to be technically impossible during build. The single most likely surprise is `tauri-plugin-shell` env inheritance from a Finder-launched .app — there's a hard gate for that in §1 below. Pass the gate before writing any other code.

---

## §0. Pre-build hard gate (5 minutes — DO NOT SKIP)

Same pattern as Phase A's pre-flight. These checks must all pass before launching parallel teams.

### 0.1. Read the verified state doc

Read `prompts/phase-b-verified-state.md` end to end. You should be able to recite without looking:
- The full v1 spawn command (`claude --print --verbose --setting-sources user --strict-mcp-config --mcp-config <...> ...`)
- Why `--setting-sources user` instead of `--bare`
- The fact that the Stop hook does NOT fire under `--setting-sources user`, so `execute_plan` must call `cortex_extract::extraction_job` directly when it sees the `result` event
- The 11 stream-json event types (system/init, system/hook_started, system/hook_response, stream_event/message_start, stream_event/content_block_{start,delta,stop}, stream_event/message_{delta,stop}, assistant, rate_limit_event, result)

### 0.2. Confirm Cortex.app can spawn `claude` with Max plan auth

This is the **single hardest gate** for Phase B. Tauri's `tauri-plugin-shell` needs to spawn `claude` from inside the running Cortex.app, and the spawned process needs to inherit access to the macOS keychain where the user's Max plan OAuth tokens live.

**Two ways to test, in order of cost:**

**Test A — quick sanity (run from a regular terminal):**

```bash
TEST_ID="$(uuidgen | tr 'A-Z' 'a-z')"
claude --print --setting-sources user \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --max-turns 1 --session-id "$TEST_ID" \
  -p "Reply with exactly: HARDGATE OK"
```

Pass = `HARDGATE OK` returned. **Already verified passing 2026-04-09.** Run again to confirm nothing has rotted.

**Test B — the real gate: spawn from Cortex.app's process tree.**

This requires a small spike committed and run in dev mode. The cleanest way:

1. Add `tauri-plugin-shell` to `src-tauri/Cargo.toml` (Phase B item 6 work — but pull it forward into the gate).
2. Add a temporary `#[tauri::command] async fn phase_b_spawn_test() -> Result<String, String>` that spawns `claude --print --setting-sources user --strict-mcp-config --mcp-config '{"mcpServers":{}}' --max-turns 1 -p "say HARDGATE2"` via the shell plugin and returns stdout.
3. Wire it into the frontend with a temporary debug button.
4. **Launch Cortex.app from Finder** (NOT terminal — the Finder launch is the harder env case).
5. Click the debug button.
6. Pass = button returns "HARDGATE2"; fail = OAuth error or "auth required" message.

If Test B fails, **stop and investigate before writing items 7–11.** Likely fixes:
- Pass `env::vars()` explicitly through `Command::new`
- Verify `HOME`, `USER`, `LOGNAME` are present in the spawned env (keychain auth needs these)
- Check that `~/.local/bin` is in the spawned PATH so `claude` is findable, OR pass the absolute path `/Users/jamq/.local/bin/claude`
- The Tauri shell allowlist may need to permit the absolute path explicitly

**The debug command and button can be removed before commit. They're scaffolding for the hard gate.**

### 0.3. Verify clean baseline

```bash
cd ~/Desktop/Cortex/src-tauri && cargo check --workspace
cd ~/Desktop/Cortex && bun run build
```

Both must pass. Phase A is `c88e5d1` on main; this should be clean.

### 0.4. Confirm test vault has at least 2 `type: plan` notes

Phase B's verification needs real plans to execute. Create them now if they don't exist:

```bash
mkdir -p ~/Desktop/Cortex/test-vault/plans
ls ~/Desktop/Cortex/test-vault/plans/*.md 2>/dev/null | wc -l
```

If < 2, the build session will need to write a couple of fixture plans before the verification step. See §4 below for the exact frontmatter.

---

## §1. The 6 items, each with file paths and signatures

Each item has: scope (what files), API (function signatures + types), and tests (what to assert).

### Item 6 — `tauri-plugin-shell` setup with strict allowlist

**Why:** Phase B needs to spawn `claude` as a child process, capture its stdout line-by-line, and tear it down on abort. `tauri-plugin-shell` is the canonical Tauri 2.x way to do this; the alternative (`std::process::Command` from inside a Tauri command) bypasses the plugin's security model.

**Scope:**
- `src-tauri/Cargo.toml` — add `tauri-plugin-shell = "2"` to `[dependencies]`
- `src-tauri/src/lib.rs` — register the plugin in the Tauri builder chain (after the existing `tauri_plugin_dialog::init()`)
- `src-tauri/tauri.conf.json` — add the shell allowlist scope. Restrict to `claude` binary only with the specific arg patterns Phase B uses.

**Allowlist specifics:**

The Tauri 2.x shell plugin uses a per-permission scope in `src-tauri/capabilities/default.json` (or similar). The relevant permission is `shell:allow-execute` with a `command` matcher. Restrict to:
- Binary: the absolute path discovered at runtime, OR `claude` if the parent env's PATH is reliable
- Args: `--print`, `--verbose`, `--setting-sources`, `--strict-mcp-config`, `--mcp-config`, `--output-format`, `--include-partial-messages`, `--include-hook-events`, `--max-turns`, `--max-budget-usd`, `--permission-mode`, `--model`, `--session-id`, `--append-system-prompt-file`, `--add-dir`, `--allowedTools`, `--disallowedTools`, `--worktree`, `-p` and their values

Do NOT permit `--bare`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, or any subcommand other than the implicit "run a prompt" shape.

**Verification:** `cargo check` passes; tauri.conf.json validates; a manual sanity spawn (item 8 will exercise this end to end).

### Item 7 — `prepare_run` Rust function

**Why:** Before spawning, Cortex must materialize everything Claude Code needs into a temp directory: a context bundle, a per-run MCP config, and the run metadata. This function is pure Rust, no Tauri, easily unit-testable.

**Scope:**
- New module `src-tauri/src/run/mod.rs` — declare `pub mod prepare;`
- New file `src-tauri/src/run/prepare.rs` — the implementation
- `src-tauri/src/lib.rs` — add `mod run;` near the top alongside `mod commands;`

**Public API:**

```rust
// src-tauri/src/run/prepare.rs

use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PlanFrontmatter {
    pub title: Option<String>,
    pub goal: Option<String>,
    pub mcp_servers: Vec<String>,           // names of MCP servers to allow (subset of Cortex's known)
    pub allowed_tools: Vec<String>,          // e.g. ["Read", "Edit", "Grep", "mcp__cortex__*"]
    pub denied_tools: Vec<String>,           // e.g. ["Bash(rm *)", "Bash(git push *)"]
    pub context_entities: Vec<String>,       // KG entity names whose subgraph to inject
    pub context_notes: Vec<String>,          // vault-relative note paths to inline verbatim
    pub model: Option<String>,               // alias or full ID; default null = let claude pick
    pub max_turns: Option<u32>,              // default 30
    pub max_budget_usd: Option<f64>,         // default 5.0
    pub permission_mode: Option<String>,     // default "acceptEdits"
    pub worktree: bool,                       // default false
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RunSpec {
    /// UUIDv4 generated for this run. Used as Claude Code's --session-id.
    pub run_id: String,
    /// Plan note's vault-relative path.
    pub plan_path: String,
    /// Frontmatter parsed from the plan note.
    pub plan: PlanFrontmatter,
    /// Absolute path to /tmp/cortex-run-<run_id>/context.md
    pub context_bundle_path: PathBuf,
    /// Absolute path to /tmp/cortex-run-<run_id>/mcp.json
    pub mcp_config_path: PathBuf,
    /// Absolute path to /tmp/cortex-run-<run_id>/ (for cleanup)
    pub run_dir: PathBuf,
    /// Vault-relative path of the pre-written `type: session` note for this run.
    pub session_note_path: String,
    /// The cwd to set on the spawned claude process. Defaults to the vault root.
    pub cwd: PathBuf,
    /// The full prompt (the plan's `goal` field, possibly augmented).
    pub prompt: String,
}

/// Read a `type: plan` note, parse its frontmatter, build the context bundle,
/// write the per-run MCP config, generate a run UUID, pre-write the session note,
/// and return a fully-resolved RunSpec ready to feed to execute_plan.
pub fn prepare_run(
    vault_root: &std::path::Path,
    plan_path: &str,
    kg: &cortex_kg::TypedKnowledgeGraph,
) -> anyhow::Result<RunSpec>;

/// Clean up a run's temp directory after the run completes (or fails).
pub fn cleanup_run(run_dir: &std::path::Path) -> anyhow::Result<()>;
```

**Implementation steps inside `prepare_run`:**

1. Generate `run_id` via the `uuid` crate: `Uuid::new_v4().to_string()`. Add `uuid = { version = "1", features = ["v4"] }` to Cargo.toml if not present.
2. Read the plan note via `cortex_core::vault::Vault::read_note(plan_path)`.
3. Verify `frontmatter.extra.get("type") == Some(&"plan".to_string())`. If not, return `Err`.
4. Parse `PlanFrontmatter` from `frontmatter.extra`. Each field comes from a string in the extra map; parse Vecs from JSON-array strings or comma-separated lists. Use sane defaults for missing fields.
5. Resolve `context_entities`: for each entity name, call `kg.serialize_subgraph(name, 2)` (the existing method). Concatenate the results.
6. Read each `context_notes` path verbatim via `vault.read_note`.
7. Build the context bundle as a markdown string:
   ```markdown
   # Cortex run context for plan: <title>

   ## Goal
   <goal>

   ## Knowledge graph subgraph
   <serialized triples from step 5>

   ## Reference notes
   ### <note path>
   <note content>
   ...
   ```
8. Create `/tmp/cortex-run-<run_id>/`. Write `context.md` (the bundle) and `mcp.json`.
9. Build the per-run `mcp.json`. Start from the user's `vault/.mcp.json` if present, then filter to only the servers in `plan.mcp_servers`. ALWAYS include the cortex MCP server (`http://127.0.0.1:3847/mcp`) so the spawned claude can call back into Cortex's tools. Shape:
   ```json
   {
     "mcpServers": {
       "cortex": { "type": "http", "url": "http://127.0.0.1:3847/mcp" }
     }
   }
   ```
10. Pre-write the session note at `vault/sessions/<run_id>.md` with frontmatter `type: session`, `session_id: <run_id>`, `plan_ref: <plan_path>`, `started_at: <ISO>`, `status: running`. (Phase A's hooks would normally do this for an interactive session — Phase B does it manually.)
11. Return the `RunSpec`.

**Tests** (`#[cfg(test)] mod tests` at the bottom of `prepare.rs`):
- `parses_minimal_plan_frontmatter` — smallest valid plan
- `parses_full_plan_frontmatter` — every field set
- `rejects_non_plan_note` — frontmatter type is not "plan"
- `resolves_context_entities_to_subgraph_string`
- `inlines_context_notes_verbatim`
- `writes_mcp_config_with_cortex_server_always_present`
- `generates_uuidv4_run_id`
- `creates_run_dir_and_files`
- `pre_writes_session_note_with_running_status`

Use `tempfile::TempDir` for the vault root in tests. Use a small in-memory `TypedKnowledgeGraph` fixture. Total: ~10 unit tests.

### Item 8 — `execute_plan` Tauri command + stream parser

**Why:** This is the heart of Phase B. Spawn `claude`, parse its stream-json output line-by-line, emit Tauri events the frontend can subscribe to, and at the end call `cortex_extract::extraction_job` to close the loop.

**Scope:**
- New file `src-tauri/src/run/execute.rs` — the command and stream parser
- `src-tauri/src/run/mod.rs` — add `pub mod execute;`
- `src-tauri/src/lib.rs` — register `commands::run::execute_plan` and `commands::run::abort_run` in the `collect_commands![...]` list. (Or put them under a new `commands/run.rs` that re-exports from `run::execute`. Pick whichever is consistent with the existing layout.)

**Public API:**

```rust
// src-tauri/src/run/execute.rs

use std::sync::Arc;
use crate::state::AppState;
use crate::run::prepare::RunSpec;
use tauri::{State, AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ExecuteRunResponse {
    pub run_id: String,
    pub session_note_path: String,
}

/// Tauri command: kick off a plan execution.
/// 1. Calls prepare_run to materialize the run dir
/// 2. Spawns claude via tauri-plugin-shell
/// 3. Returns immediately with the run_id; the rest is async via Tauri events
/// 4. The spawned process's stream-json output is parsed line-by-line by a
///    background task that emits Tauri events
#[tauri::command]
#[specta::specta]
pub async fn execute_plan(
    plan_path: String,
    state: State<'_, Arc<AppState>>,
    app: AppHandle,
) -> Result<ExecuteRunResponse, String>;

/// Tauri command: abort an in-flight run by run_id.
/// Sends SIGTERM to the spawned process. The background task will detect
/// the early exit and emit a `cortex://session/aborted` event.
#[tauri::command]
#[specta::specta]
pub async fn abort_run(
    run_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String>;
```

**`AppState` additions:**

```rust
// src-tauri/src/state.rs (add to AppState struct)

/// Tracks in-flight Phase B runs by run_id → child process handle for abort.
/// Use tokio::sync::Mutex (not std::sync::Mutex) — held across await points.
pub active_runs: tokio::sync::Mutex<std::collections::HashMap<String, tauri_plugin_shell::process::CommandChild>>,
```

(Initialize in `AppState::new` with `tokio::sync::Mutex::new(HashMap::new())`.)

**Spawn implementation steps:**

1. Lock vault, get vault_root. If no vault, return Err.
2. Lock KG read. If no KG, return Err.
3. Call `prepare::prepare_run(&vault_root, &plan_path, &*kg)?`. Get the `RunSpec`.
4. Build the args vec for `claude`:
   ```
   --print --verbose
   --setting-sources user
   --strict-mcp-config --mcp-config <run_spec.mcp_config_path>
   --output-format stream-json --include-partial-messages --include-hook-events
   --max-turns <plan.max_turns or 30>
   --max-budget-usd <plan.max_budget_usd or 5.0>
   --permission-mode <plan.permission_mode or "acceptEdits">
   [--model <plan.model>]                          (only if Some)
   --session-id <run_spec.run_id>
   --append-system-prompt-file <run_spec.context_bundle_path>
   --add-dir <vault_root>
   [--allowedTools <plan.allowed_tools.join(" ")>] (only if non-empty)
   [--disallowedTools <plan.denied_tools.join(" ")>] (only if non-empty)
   [--worktree]                                     (only if plan.worktree)
   -p <run_spec.prompt>
   ```
5. Get the `Shell` handle: `app.shell()`. Build the command via `shell.command("claude").args(args).current_dir(&run_spec.cwd)`. Do NOT pass any custom env — inherit the parent env unchanged so OAuth keychain access works.
6. Spawn with `command.spawn()`. This returns `(CommandChild, Receiver<CommandEvent>)`.
7. Insert the `CommandChild` into `state.active_runs` under `run_id`.
8. Emit `cortex://session/started` immediately with `{ run_id, session_note_path, plan_path }` so the frontend can switch to the live session sheet right away.
9. Spawn a `tokio::spawn(async move {...})` background task that:
   a. Reads `CommandEvent`s from the receiver in a loop.
   b. For each `CommandEvent::Stdout(line)`, parses it as JSON. If parse fails, log and continue.
   c. For each parsed event, emit a Tauri event named `cortex://session/event/<run_id>` with the JSON object as payload (the frontend filters by run_id via the channel name).
   d. Track the in-memory transcript: append every parsed event to a `Vec<serde_json::Value>` (the in-memory transcript builder — see §2 below).
   e. When the `result` event arrives:
      - Update the session note frontmatter to add `ended_at`, `status: complete` (or `failed` if `is_error`), `total_cost_usd`, `duration_ms`, `num_turns`
      - Convert the in-memory event vec into a `cortex_extract::transcript::ParsedTranscript` (use a new helper `from_stream_events` — see §2)
      - Call `cortex_extract::extraction_job(kg, vault_root, run_id, transcript_pseudo_path)` — but extraction_job currently reads from disk. **Decision:** add a sibling function `cortex_extract::extraction_job_from_parsed(kg, vault_root, session_id, parsed)` that takes an already-parsed transcript instead of a path. Phase B uses that variant. The disk-based variant stays for Phase A.
      - Emit `cortex://session/completed` with the final usage stats.
      - Remove the run from `state.active_runs`.
      - Call `prepare::cleanup_run(&run_spec.run_dir)`.
   f. For `CommandEvent::Stderr(line)`, log at warn level. (Phase B doesn't surface stderr in the live sheet — it's mostly Claude Code's own progress noise.)
   g. For `CommandEvent::Terminated(payload)` BEFORE a `result` event was seen, emit `cortex://session/aborted` with the exit code. Also remove from `active_runs` and cleanup.
10. Return `ExecuteRunResponse { run_id, session_note_path }` immediately. The background task runs to completion independently.

**Tauri event contract (the canonical list — Team C consumes these from frontend):**

| Event name | Payload shape | When |
|---|---|---|
| `cortex://session/started` | `{ run_id, session_note_path, plan_path }` | Immediately after spawn succeeds |
| `cortex://session/event/<run_id>` | The raw stream-json object (one of system/init, hook_started, hook_response, message_start, content_block_*, message_*, assistant, rate_limit_event) | One per stdout line |
| `cortex://session/completed` | `{ run_id, total_cost_usd, duration_ms, num_turns, retrospective_path? }` | After `result` event + extraction job |
| `cortex://session/aborted` | `{ run_id, exit_code, partial_event_count }` | Process terminated before `result` |
| `cortex://session/error` | `{ run_id, message }` | Spawn failed or extraction errored; non-fatal otherwise |

The frontend listens via Tauri's event API: `import { listen } from '@tauri-apps/api/event'`.

**Stream parser tests** (`#[cfg(test)]` in `execute.rs`):

- `parses_minimal_stream_json_run` — feed a fixture stream-json string, assert the in-memory event vec matches
- `extracts_result_event_metadata` — given a result event JSON, pull out duration/cost/num_turns
- `survives_unparseable_lines` — feed mixed valid + garbage lines, assert valid ones are kept
- `marks_run_as_failed_when_result_is_error`

The actual spawn logic is hard to unit-test (requires a real claude binary). Test it via the verification sequence in §4 instead.

### Item 9 — `session` sheet kind (live transcript view)

**Why:** When a Phase B run starts, the user needs to see what's happening live. This sheet kind subscribes to the `cortex://session/event/<run_id>` Tauri event stream and renders the unfolding session.

**Scope:**
- `src/lib/types/layout.ts` — add `session` to `SheetContent` discriminated union: `| { kind: "session"; runId: string; planPath: string }`
- `src/components/layout/Sheet.tsx` — add a `case "session":` in the `SheetContent` switch that renders `<LiveSessionView ... />`
- New file `src/components/session/LiveSessionView.tsx` — the renderer
- New file `src/components/session/MessageBubble.tsx` — renders one assistant or user message
- New file `src/components/session/ToolCallBlock.tsx` — renders a tool_use block with input/output
- New file `src/components/session/ThinkingBlock.tsx` — renders a thinking block (collapsible, dimmed)
- New file `src/stores/runStore.ts` — Zustand store keyed by run_id, holds the message list, status, cost, etc.

**`runStore.ts` shape:**

```typescript
import { create } from 'zustand';

export interface RunMessage {
  id: string;                    // assistant message id from stream
  role: 'assistant' | 'user';
  blocks: RunBlock[];
  done: boolean;
}

export type RunBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string; collapsed: boolean }
  | { type: 'tool_use'; toolName: string; input: any; output?: any };

export interface RunState {
  runId: string;
  planPath: string;
  status: 'starting' | 'running' | 'complete' | 'failed' | 'aborted';
  messages: RunMessage[];
  totalCostUsd: number;
  durationMs?: number;
  numTurns?: number;
  retrospectivePath?: string;
}

interface RunStore {
  runs: Record<string, RunState>;
  initRun: (runId: string, planPath: string) => void;
  applyEvent: (runId: string, event: any) => void;
  markCompleted: (runId: string, payload: { total_cost_usd: number; duration_ms: number; num_turns: number; retrospective_path?: string }) => void;
  markAborted: (runId: string, exitCode: number) => void;
  markFailed: (runId: string, message: string) => void;
}

export const useRunStore = create<RunStore>((set) => ({
  runs: {},
  initRun: (runId, planPath) => set((s) => ({
    runs: { ...s.runs, [runId]: { runId, planPath, status: 'starting', messages: [], totalCostUsd: 0 } }
  })),
  applyEvent: (runId, event) => set((s) => {
    const run = s.runs[runId];
    if (!run) return s;
    // Big switch on event.type — see below
    return { runs: { ...s.runs, [runId]: applyEventReducer(run, event) } };
  }),
  markCompleted: (runId, payload) => set((s) => ({
    runs: { ...s.runs, [runId]: { ...s.runs[runId], status: 'complete', ...payload } }
  })),
  markAborted: (runId, exitCode) => set((s) => ({
    runs: { ...s.runs, [runId]: { ...s.runs[runId], status: 'aborted' } }
  })),
  markFailed: (runId, message) => set((s) => ({
    runs: { ...s.runs, [runId]: { ...s.runs[runId], status: 'failed' } }
  })),
}));

// applyEventReducer handles the big switch:
// - system/init      → status = 'running'
// - message_start    → push new RunMessage with empty blocks
// - content_block_start (text)     → push { type: 'text', text: '' } block
// - content_block_start (thinking) → push { type: 'thinking', text: '', collapsed: true } block
// - content_block_start (tool_use) → push { type: 'tool_use', toolName, input: null } block
// - content_block_delta (text_delta)     → append delta.text to last block
// - content_block_delta (thinking_delta) → append delta.thinking to last thinking block
// - content_block_delta (input_json_delta) → accumulate partial_json into last tool_use block.input
// - content_block_stop → mark block as done (no-op for most types)
// - message_stop → mark message done = true
// - assistant (full snapshot) → optionally use as canonical text, but if deltas were already applied, ignore
// - rate_limit_event → store in run.rateLimitWarning (display as banner)
// - hook_started / hook_response → mostly ignore (internal); could track count
```

**`LiveSessionView.tsx` shape:**

```tsx
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRunStore } from '@/stores/runStore';
import { MessageBubble } from './MessageBubble';

interface LiveSessionViewProps {
  runId: string;
  planPath: string;
}

export function LiveSessionView({ runId, planPath }: LiveSessionViewProps) {
  const run = useRunStore((s) => s.runs[runId]);
  const initRun = useRunStore((s) => s.initRun);
  const applyEvent = useRunStore((s) => s.applyEvent);
  const markCompleted = useRunStore((s) => s.markCompleted);
  // ... etc

  useEffect(() => {
    initRun(runId, planPath);

    const unlistens: Array<() => void> = [];

    listen<any>(`cortex://session/event/${runId}`, (e) => applyEvent(runId, e.payload))
      .then((u) => unlistens.push(u));
    listen<{ run_id: string; total_cost_usd: number; duration_ms: number; num_turns: number; retrospective_path?: string }>(
      'cortex://session/completed',
      (e) => { if (e.payload.run_id === runId) markCompleted(runId, e.payload); }
    ).then((u) => unlistens.push(u));
    // ... aborted, failed, error

    return () => { unlistens.forEach((u) => u()); };
  }, [runId, planPath]);

  if (!run) return <div>Loading…</div>;

  return (
    <div /* ... inline styles, var(--*) tokens, frontend-design-system */>
      {/* Header: plan title, model, status pill, cost, abort button */}
      {/* Messages: run.messages.map(m => <MessageBubble key={m.id} message={m} />) */}
      {/* Footer: live event count, retrospective link when complete */}
    </div>
  );
}
```

**Styling:** Follow the `frontend-design-system` skill. Inline styles for Safari 15. CSS vars (`var(--bg-primary)`, `var(--text-primary)`, etc.). Look at how Phase A's `SessionsPanel.tsx` was styled — same conventions.

**Tests:** No unit tests for the React components in v1 (Phase A didn't either). Verification is end-to-end in §4.

### Item 10 — `plan-runner` sheet kind (Execute button)

**Why:** When the user opens a `type: plan` note, instead of the normal markdown editor, they should see a richer view: editable frontmatter + an "Execute" button that fires `execute_plan`.

**Scope:**
- `src/lib/types/layout.ts` — `SheetContent` adds `| { kind: "plan-runner"; planPath: string }`
- `src/components/layout/Sheet.tsx` — add `case "plan-runner":`
- New file `src/components/plan/PlanRunnerView.tsx` — the renderer
- New file `src/components/plan/PlanFrontmatterEditor.tsx` — editable frontmatter form (model, max_turns, etc.)
- `src/components/sidebar/FileExplorer.tsx` — when the user clicks a file, check if it has `type: plan` frontmatter and route to `plan-runner` sheet kind instead of normal `file` kind.

**`PlanRunnerView.tsx` shape:**

```tsx
import { invoke } from '@tauri-apps/api/core';
import { useLayoutStore } from '@/stores/layoutStore';

interface PlanRunnerViewProps {
  planPath: string;
}

export function PlanRunnerView({ planPath }: PlanRunnerViewProps) {
  // 1. Read the plan note via invoke<NoteData>("read_note", { path: planPath })
  // 2. Display the body as markdown preview
  // 3. Display the frontmatter as an editable form (PlanFrontmatterEditor)
  // 4. "Execute" button → invoke<ExecuteRunResponse>("execute_plan", { planPath })
  //    On success: replace the current sheet with { kind: "session", runId, planPath }
  //    via useLayoutStore.getState().setSheetContent(activeSheetId, { kind: "session", ... })
  // 5. "Save" button on the frontmatter editor → write the note back via write_note Tauri command
  return ( /* ... */ );
}
```

**File explorer routing:** When a `.md` file is clicked, the explorer normally calls `openFile(sheetId, path, content)` which sets sheet content to `{ kind: "file", ... }`. For Phase B, parse the frontmatter (the note's `extra` map already has `type` after Phase A's frontmatter parser), and if `type === "plan"`, route to `{ kind: "plan-runner", planPath: path }` instead. Falls back to normal file editor for everything else.

**Tests:** None in v1. Verified end-to-end in §4.

### Item 11 — Plan-status sidebar panel

**Why:** Discoverability. The user needs a way to see all `type: plan` notes grouped by status (draft / ready / running / complete / failed) without manually browsing the file tree.

**Scope:**
- `src/lib/types/index.ts` — add `"plans"` to the `SidebarPanel` union (alongside the existing `sessions` from Phase A)
- `src/components/sidebar/PlansPanel.tsx` — new component
- `src/components/layout/Sidebar.tsx` — add nav item, panel routing
- `src/components/layout/Sheet.tsx` — add `case "plans":` in `PanelContent` switch
- New Tauri command in `src-tauri/src/commands/plans.rs` — `list_plan_notes` that scans `vault/plans/**.md` and any other `.md` with `type: plan` frontmatter, returns `Vec<PlanSummary>`

**`PlanSummary` shape:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PlanSummary {
    pub path: String,           // vault-relative
    pub title: String,
    pub goal: Option<String>,
    pub status: String,         // "draft" | "ready" | "running" | "complete" | "failed"
    pub model: Option<String>,
    pub last_run_id: Option<String>,
    pub last_run_at: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn list_plan_notes(state: State<'_, Arc<AppState>>) -> Result<Vec<PlanSummary>, String>;
```

The status comes from the plan's frontmatter `status` field. `running` is set by `execute_plan` (via the pre-written session note's status, or by writing to the plan note itself — pick one and stick with it; the spec leaves this to the build session to decide based on what's cleaner).

**`PlansPanel.tsx`:** styled like `SessionsPanel` from Phase A — inline styles, var(--*) tokens, lucide icons. Group entries by status, click to open as `plan-runner` sheet.

**Tests:** None in v1.

---

## §2. Cross-cutting: in-memory transcript builder for cortex-extract

Phase B's `execute_plan` collects stream events in memory. To call `cortex_extract::extraction_job` directly without writing to disk, we need:

**Add to `cortex-extract/src/transcript.rs`:**

```rust
/// Build a ParsedTranscript from a sequence of stream-json event objects.
/// Mirrors the disk parser but operates on already-deserialized JSON.
pub fn parse_stream_events(events: &[serde_json::Value]) -> ParsedTranscript;
```

**Add to `cortex-extract/src/extract.rs`:**

```rust
/// Variant of extraction_job that takes an already-parsed transcript instead
/// of reading from a JSONL file. Used by Phase B's execute_plan when the
/// in-memory transcript is built from stream-json events.
pub async fn extraction_job_from_parsed(
    kg: std::sync::Arc<std::sync::RwLock<Option<cortex_kg::TypedKnowledgeGraph>>>,
    vault_root: std::path::PathBuf,
    session_id: String,
    parsed: crate::transcript::ParsedTranscript,
) -> anyhow::Result<()>;
```

The existing `extraction_job` becomes a thin wrapper: parse the JSONL file then call `extraction_job_from_parsed`.

**Tests:**
- `parse_stream_events_extracts_user_messages_from_assistant_response` — assistant text becomes assistant_messages
- `parse_stream_events_extracts_tool_uses` — tool_use content blocks become tool_calls and (for file-writing tools) files_modified
- `parse_stream_events_handles_thinking_blocks` — thinking is included in assistant_messages or stored separately

This is technically Phase B work but lives in `cortex-extract`. **Team C (the Tauri command + stream parser team) owns it** since they're the ones who need it.

---

## §3. Parallel team plan

**4 teams, mostly file-disjoint, one minor coordination point.**

| Team | Items | Files owned |
|---|---|---|
| **A — Setup + prepare_run** | 6 (shell plugin), 7 (prepare_run) | `src-tauri/Cargo.toml` (add `tauri-plugin-shell`, `uuid`); `src-tauri/tauri.conf.json` or `src-tauri/capabilities/default.json` (allowlist); `src-tauri/src/lib.rs` (register shell plugin only — coordination point); new `src-tauri/src/run/mod.rs`; new `src-tauri/src/run/prepare.rs` |
| **B — execute_plan + extraction integration** | 8 (execute_plan), §2 (in-memory transcript builder) | new `src-tauri/src/run/execute.rs`; `src-tauri/crates/cortex-extract/src/transcript.rs` (add `parse_stream_events`); `src-tauri/crates/cortex-extract/src/extract.rs` (add `extraction_job_from_parsed`); `src-tauri/src/state.rs` (add `active_runs` field — coordination point); `src-tauri/src/lib.rs` (register `execute_plan`, `abort_run` commands — coordination point) |
| **C — UI: plan-runner + live session sheet** | 9 (session sheet), 10 (plan-runner sheet) | `src/lib/types/layout.ts`; `src/components/layout/Sheet.tsx`; new `src/components/session/**` (LiveSessionView, MessageBubble, ToolCallBlock, ThinkingBlock); new `src/components/plan/**` (PlanRunnerView, PlanFrontmatterEditor); new `src/stores/runStore.ts`; `src/components/sidebar/FileExplorer.tsx` (route plan files to plan-runner kind) |
| **D — Plans sidebar panel** | 11 (plans panel) | `src/lib/types/index.ts` (add `"plans"` to SidebarPanel union); new `src/components/sidebar/PlansPanel.tsx`; `src/components/layout/Sidebar.tsx` (add nav item + routing); `src/components/layout/Sheet.tsx` (add panel case — minor conflict with Team C, see below); new `src-tauri/src/commands/plans.rs`; `src-tauri/src/commands/mod.rs` (add `pub mod plans;`); `src-tauri/src/lib.rs` (register `list_plan_notes` — coordination point) |

### Coordination points (3 total — fewer than Phase A)

1. **`src-tauri/src/lib.rs` `collect_commands![...]` list** — Teams A, B, D all add commands. Conflict resolved by:
   - Team A adds nothing to the commands list (prepare_run is not a Tauri command, just a Rust function).
   - Team B adds `commands::run::execute_plan, commands::run::abort_run` (or wherever they end up).
   - Team D adds `commands::plans::list_plan_notes`.
   - All three teams write their additions in order. Whoever merges first wins; the rest re-resolve. The lines are independent — git will likely auto-merge.

2. **`src-tauri/src/state.rs`** — Team B adds the `active_runs` field. Phase A wrapped `knowledge_graph` in `Arc` for the same reason; the change here is similar:
   ```rust
   pub active_runs: tokio::sync::Mutex<HashMap<String, CommandChild>>,
   ```
   No other team touches state.rs.

3. **`src/components/layout/Sheet.tsx`** — Teams C and D both add cases to the switch. Team C adds `case "session":` and `case "plan-runner":` to the `SheetContent` switch. Team D adds `case "plans":` to the `PanelContent` switch (different switch, lower in the file). Should not conflict if they touch different switches; verify visually before committing.

### Sequencing note

Team A finishes first (smallest team, pure Rust additions). Team B depends on:
- Team A's `RunSpec` shape (signature defined in this spec — Team B can build against it without waiting)
- The shell plugin being added to Cargo.toml (Team A's job)
- The hard gate from §0.2 passing

Team B is the largest and longest. Teams C and D start at t=0 with the documented Tauri event contract (§1, item 8) — they don't need Team B's code to compile against, only the event names and payload shapes.

### Hard gate before launching teams

**§0.2's Test B** (spawn from Cortex.app via tauri-plugin-shell, returns "HARDGATE2") MUST pass before any team writes a line of code beyond what's needed to run that test. If it fails, the whole build is on hold until it works. Possible fixes are listed in §0.2.

---

## §4. End-to-end verification sequence

After all 4 teams merge and both builds pass, run this sequence. Each step has a concrete pass/fail signal mapped to the item that broke if it fails.

### Pre-verification setup

Create a fixture plan note in the test vault:

```bash
mkdir -p ~/Desktop/Cortex/test-vault/plans
cat > ~/Desktop/Cortex/test-vault/plans/2026-04-09-add-readme.md <<'EOF'
---
type: plan
title: Add a README to the test vault
status: ready
goal: Create a README.md file in the test vault root that describes what notes live there. List the three Wave notes in the sessions/ directory by name.
allowed_tools: ["Read", "Write", "Edit", "Bash(ls *)", "mcp__cortex__*"]
denied_tools: ["Bash(rm *)", "Bash(git *)"]
context_entities: ["Knowledge Graph", "Cortex"]
context_notes: ["sessions/2026-04-08_wave1-foundation.md"]
model: claude-sonnet-4-5
max_turns: 5
max_budget_usd: 1
permission_mode: acceptEdits
worktree: false
---

This is a small smoke test for Cortex Phase B.
EOF
```

### The 9 steps

1. **Open Cortex, open `~/Desktop/Cortex/test-vault/`.**
   Pass: vault loads, KG re-loads (Phase A's fix), `.claude/settings.json` is intact (Phase A wrote it earlier).
   Fail → Phase A regression.

2. **Click the new "Plans" icon in the sidebar rail (item 11).**
   Pass: a "Plans" panel opens listing `plans/2026-04-09-add-readme.md` with status `ready`.
   Fail → item 11.

3. **Click the plan in the list.**
   Pass: the active sheet switches to a `plan-runner` view showing the plan's title, goal, frontmatter form, and an Execute button.
   Fail → item 10 OR FileExplorer routing.

4. **Click "Execute".**
   Pass: the sheet immediately switches to a `session` view (item 9), showing a "Starting…" header and a streaming live transcript view.
   Fail → item 8 (spawn) OR item 9 (event subscription).

5. **Watch the live transcript stream in.**
   Pass: within ~2 seconds, the assistant's first message bubble appears, then content blocks fill in token-by-token. Tool calls (Read, Write) render as their own blocks.
   Fail → item 8 stream parser OR item 9 reducer OR Tauri event contract mismatch.

6. **Wait for completion (~30–60 seconds for this fixture plan).**
   Pass: the run header transitions from `running` → `complete` with cost shown (e.g. "$0.12 equivalent").
   Fail → item 8 result handling OR backend extraction trigger.

7. **Confirm a `README.md` was created in the vault root.**
   Pass: `ls ~/Desktop/Cortex/test-vault/README.md` exists with content matching the goal.
   Fail → spawned claude didn't actually run the tools, or `--add-dir` was wrong, or `--allowedTools` was too restrictive.

8. **Confirm a retrospective note appeared in `vault/sessions/<run_id>-retrospective.md`.**
   Pass: file exists with summary, what_worked, etc.
   Fail → `extraction_job_from_parsed` wasn't called OR it errored.

9. **Confirm the KG has new entities/relations from the run.**
   Pass: `python3 -c "import json; kg=json.load(open('test-vault/.cortex/kg.json')); print(len(kg['entities']), len(kg['relations']))"` shows higher counts than before the run, AND at least one entity has the run_id in its source_notes.
   Fail → extraction succeeded but didn't write back to KG, OR Vertex call failed (check logs).

### Bonus verification

10. **Click the plan in the Plans panel again** while the run is still in flight.
    Pass: the live session sheet is preserved (you can flip between plan-runner and session views without losing state).

11. **Abort a run mid-way** (start a longer plan, click an "Abort" button if Team B added one).
    Pass: process gets SIGTERM, stream stops, status shows `aborted`, cleanup_run removed `/tmp/cortex-run-<id>/`.

If any of steps 1–9 fail, fix the responsible item before declaring Phase B done. Step 11 is nice-to-have for v1.

---

## §5. Risk register

Risks and likelihoods, in order of how much they could derail the build:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **R-B1** Tauri-plugin-shell from Finder-launched .app can't access macOS keychain → spawned claude fails OAuth | Med | Critical | §0.2 hard gate (Test B). If it fails, fix BEFORE starting other teams. Workarounds: explicit env passthrough; absolute path to claude binary; document that user must launch Cortex from terminal until fixed. |
| **R-B2** Stream-json line buffering — partial lines on stdout chunks | Low-med | Med | Use a line-buffered reader (`BufReader::lines()`); the existing tauri-plugin-shell `CommandEvent::Stdout(line)` already line-buffers. Verify in Team B's tests. |
| **R-B3** Plan frontmatter parsing — Vec fields from YAML are messy via the `extra: HashMap<String, String>` flattening | Med | Low | The existing `cortex_core` parser stores `extra` as String values. Team A must parse Vec fields from `serde_yaml::from_str` directly OR adopt a stricter `PlanFrontmatter` deserializer that bypasses `extra`. Either works; pick one. |
| **R-B4** `cortex_extract::extraction_job_from_parsed` doesn't yet exist; existing `extraction_job` reads from disk only | High (planned) | Low | This is a known refactor. Team B owns it. Add the new function alongside the old; the old wraps the new. |
| **R-B5** UUIDv4 not in deps | Low | Trivial | Add `uuid = { version = "1", features = ["v4"] }` to `src-tauri/Cargo.toml` (Team A). |
| **R-B6** `--worktree` ignored under `--print` mode | Med | Low | Phase B fixture plan sets `worktree: false`. If a real plan sets `worktree: true` and it doesn't take effect, log a warning. Don't block on this in v1. |
| **R-B7** Plugin SessionStart hooks (superpowers etc.) fire under `--setting-sources user` and pollute the transcript | Med | Med | Verified in spike — they DO fire (`hook_started` / `hook_response` events). Acceptable for v1. If pollution becomes a problem, look for a `--no-plugins` flag in the leaked source or use `--strict-mcp-config` more aggressively. |
| **R-B8** `tool_use` event shape varies between top-level and nested | Low | Low | The existing `cortex-extract/src/transcript.rs` handles the nested form. Team B's `parse_stream_events` should reuse the same shape inspection. |
| **R-B9** Specta bindings for new commands not regenerated → frontend invokes fail at runtime | Med | Med | Phase A had this same issue with `list_session_notes`. Workaround: define local TypeScript interfaces in the Phase B UI components that mirror the Rust types. Team C should not depend on auto-generated bindings.ts for new types until cargo dev runs once. |
| **R-B10** Aborting a run leaves zombie temp dir or zombie process | Low | Low | `cleanup_run` is called from both the success path and the abort path. SIGTERM should propagate to claude's tokio runtime. Verify with the bonus step 11. |
| **R-B11** Two runs of the same plan in parallel → race on session note path | Low | Med | Each run has its own UUID, so the session note path is unique. The plan note's `status: running` field could race; ignore the race for v1, the last writer wins. |
| **R-B12** The `cortex` MCP server entry in per-run mcp.json points at `localhost:3847` but the spawned claude is in a worktree and the host port mapping breaks | Low | Low | macOS bare spawn doesn't break host networking. The worktree only changes cwd, not network. Should be fine. |

---

## §6. What Phase B does NOT include (out of scope)

Be ruthless about scope. Phase B v1 is the 6 items above. Specifically NOT in v1:

- **Plan templates** ("create a new plan from template X"). Future polish.
- **Multi-step plans** that chain multiple `claude` invocations. Future Phase C.
- **Plan version history** (track edits to a plan note). Use git.
- **Cost dashboard** aggregating across runs. Future.
- **Notifications** when a long-running plan completes. Future.
- **Plan presets / "favorite plans"** in a quick launcher. Future.
- **Plan diffing** (compare what was planned vs what happened). Future.
- **Resume / continue** an aborted run. Phase B v1 always starts fresh — `--continue` and `--resume` are not used.
- **Custom TUI harness with non-Claude models via Vertex** — that's the Phase B "future era" from the verified state doc. Not v1.
- **Editing the plan note WHILE it executes** — sheet kind transitions on Execute and stays on the live view until completion or abort. Editing is locked during run. Future polish.

---

## §7. Reference: deliverables checklist

When Phase B is done, the following should exist:

**Backend (Rust):**
- [ ] `tauri-plugin-shell` registered with strict allowlist
- [ ] `uuid` crate added to deps
- [ ] `src-tauri/src/run/mod.rs`, `prepare.rs`, `execute.rs`
- [ ] `src-tauri/src/commands/plans.rs`
- [ ] `state.rs` has `active_runs` field
- [ ] `lib.rs` registers `execute_plan`, `abort_run`, `list_plan_notes`
- [ ] `cortex-extract` has `parse_stream_events` + `extraction_job_from_parsed`
- [ ] ~10 unit tests in `prepare.rs`
- [ ] ~5 unit tests in `execute.rs` (stream parser only)
- [ ] ~3 unit tests in `cortex-extract/src/transcript.rs` for `parse_stream_events`

**Frontend (TypeScript/React):**
- [ ] `SheetContent` union has `session` and `plan-runner` variants
- [ ] `SidebarPanel` union has `plans` variant
- [ ] `LiveSessionView`, `MessageBubble`, `ToolCallBlock`, `ThinkingBlock` components
- [ ] `PlanRunnerView`, `PlanFrontmatterEditor` components
- [ ] `PlansPanel` component
- [ ] `runStore.ts` Zustand store
- [ ] `Sheet.tsx` routes session + plan-runner sheet kinds
- [ ] `Sidebar.tsx` has Plans nav item
- [ ] `FileExplorer.tsx` routes `type: plan` notes to plan-runner instead of file editor

**Build:**
- [ ] `cargo check --workspace` clean
- [ ] `cargo test --workspace` all green (≥45 tests total — Phase A's 29 + Phase B's ~16 new)
- [ ] `bun run build` clean

**Verification:**
- [ ] Steps 1–9 of §4 all pass on the fixture plan
- [ ] Bonus steps 10–11 pass

**Commit:**
- [ ] Single commit on main: `feat: Phase B — plan execution orchestrator`
- [ ] Pushed to `origin/main`

---

## §8. The commit message template

```
feat: Phase B — plan execution orchestrator

- tauri-plugin-shell with strict allowlist for the claude binary
- prepare_run: parses type:plan notes, resolves KG context, materializes
  per-run context bundle and MCP config under /tmp/cortex-run-<uuid>/
- execute_plan Tauri command: spawns `claude --print --setting-sources user`
  via plugin-shell, parses stream-json line-by-line into Tauri events,
  triggers cortex_extract::extraction_job_from_parsed on result, cleans up
- session sheet kind with live transcript view (message bubbles, thinking
  blocks, tool calls), Zustand runStore tracking events per run_id
- plan-runner sheet kind: editable frontmatter form + Execute button,
  routed automatically when a type:plan note is opened
- Plans sidebar panel listing type:plan notes grouped by status
- cortex-extract: new parse_stream_events + extraction_job_from_parsed
  variants so Phase B can extract from in-memory event sequences

The other half of the loop closes: not just capturing what Claude Code did,
but launching Claude Code from Cortex with curated KG context, watching it
execute live, and folding the result back into the typed graph automatically.
Auth via the user's Max plan OAuth (--setting-sources user, no --bare, no
Vertex). Future custom TUI harness will swap in Vertex for non-Claude models.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## How to launch the Phase B build session

Open a fresh Claude Code session in `~/Desktop/Cortex/`. Paste the contents of a new `prompts/phase-b-building.md` (analogous to Phase A's `session-3-building.md` — write it as part of this planning round if it doesn't exist). The build prompt should:

1. Tell the agent it's executing Phase B
2. Point it at this spec (`prompts/phase-b-build-spec.md`) and the verified state doc (`prompts/phase-b-verified-state.md`)
3. Enumerate the skills to activate (subagent-driven-development, dispatching-parallel-agents, verification-before-completion, frontend-design-system, claude-api)
4. Include the §0.2 hard gate explicitly — do not let the build start until it passes
5. Tell it to dispatch the 4 teams in parallel
6. Tell it to run the 9-step verification before committing
7. Tell it to commit + push when verification passes

Until that build prompt exists, the build agent has to read this spec carefully on its own. Either path works — Phase A's session-3-building.md was a thin wrapper around the spec.
