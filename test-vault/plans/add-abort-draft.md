---
type: plan
title: "Add abort_draft Tauri command + cancel button for in-flight plan drafting"
status: ready
goal: "Mirror the existing abort_run pattern to let users cancel an in-flight Phase B drafting spawn. Currently draft_plan_from_goal runs ~30-60s and there's no way to stop it. Add a CommandChild handle tracked by draft_id in AppState, an abort_draft Tauri command that SIGTERMs it, and a cancel X button in PlansPanel's 'Drafting plan…' pill. Update draft_plan_from_goal to track the child handle."
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash(cargo check *)", "Bash(cargo test *)", "Bash(cargo build *)", "Bash(bun run build*)"]
denied_tools: ["Bash(rm *)", "Bash(git push *)", "Bash(git commit *)", "Bash(cargo install *)"]
context_entities: []
context_notes:
  - "patterns/Pattern - Safari 15 Compatibility.md"
model: claude-sonnet-4-5
max_turns: 25
max_budget_usd: 3
permission_mode: acceptEdits
worktree: false
---

# Add abort_draft — cancel in-flight plan drafting

## Why this plan exists

`draft_plan_from_goal` (in `src-tauri/src/commands/plans.rs`) spawns
`claude --print --permission-mode plan` and waits 30-60 seconds for the
full 5-phase plan-mode workflow to complete. During that time the user
sees a "Drafting plan…" pill in PlansPanel but has NO way to cancel.

The equivalent for plan *execution* (`execute_plan` in
`src-tauri/src/run/execute.rs`) already has `abort_run` — it tracks the
`CommandChild` in `AppState.active_runs` keyed by run_id, and `abort_run`
SIGTERMs it. The Live Session View has an Abort button.

This plan mirrors that pattern for drafting so the user can cancel a
stuck or runaway draft.

## Preconditions

- `git status` clean (or only expected untracked files)
- `cargo test --workspace` passes
- `bun run build` passes

## Required changes

### 1. `src-tauri/src/state.rs` — add active_drafts field

```rust
/// In-flight Phase B drafts keyed by draft_id, tracked so abort_draft
/// can SIGTERM the spawned `claude --permission-mode plan` child.
pub active_drafts: AsyncMutex<HashMap<String, CommandChild>>,
```

Initialize in `AppState::new()`:
```rust
active_drafts: AsyncMutex::new(HashMap::new()),
```

`AsyncMutex`, `HashMap`, and `CommandChild` are already imported (they're
used by `active_runs`).

### 2. `src-tauri/src/commands/plans.rs` — track the draft child + new command

Currently `draft_plan_from_goal` does:
```rust
let (mut rx, _child) = shell.command("claude")...spawn()?;
```
and the `_child` handle is dropped immediately.

Change to:
```rust
let (mut rx, child) = shell.command("claude")...spawn()?;
{
    let mut drafts = state.active_drafts.lock().await;
    drafts.insert(draft_id.clone(), child);
}
```

And in ALL three exit paths (result received, error path, early termination)
remove the draft from active_drafts BEFORE returning:
```rust
{
    let mut drafts = state.active_drafts.lock().await;
    drafts.remove(&draft_id);
}
```

This matches the `execute_plan` pattern exactly. See
`src-tauri/src/run/execute.rs::run_event_loop` for the canonical cleanup
pattern.

Add a new Tauri command:
```rust
#[tauri::command]
#[specta::specta]
pub async fn abort_draft(
    draft_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let child = {
        let mut drafts = state.active_drafts.lock().await;
        drafts.remove(&draft_id)
    };
    match child {
        Some(c) => c.kill().map_err(|e| format!("kill failed: {}", e)),
        None => Err(format!("draft {} not active", draft_id)),
    }
}
```

Also emit a `cortex://draft/aborted` event when the spawn terminates
without producing a result AND the exit code suggests SIGTERM (code 143 or
signal Some(15)). Payload: `{ draft_id, partial_event_count }`. Mirror the
`cortex://session/aborted` event shape from execute.rs.

In the function that handles a missing result + early termination, treat
aborted differently from "genuinely crashed": return a specific error
string like "draft aborted by user" so the frontend can distinguish.

### 3. `src-tauri/src/lib.rs` — register the new command

Add `commands::plans::abort_draft` to the `collect_commands![]` list in
alphabetical-ish order next to `draft_plan_from_goal`.

### 4. `src/components/sidebar/PlansPanel.tsx` — track draft_id + cancel button

Currently the drafting flow does not expose a draft_id to the frontend.
Fix this by:

a) Listen for `cortex://draft/started` and capture `e.payload.draft_id`
   into a React state variable `currentDraftId` (string | null).

b) In the "Drafting plan…" pill, add a small X button:
```tsx
{currentDraftId && (
  <button
    onClick={async () => {
      try {
        await invoke("abort_draft", { draftId: currentDraftId });
      } catch (e) {
        console.warn("[Cortex] abort_draft failed", e);
      }
    }}
    style={{
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      padding: "2px 6px",
      fontSize: 10,
      borderRadius: 4,
      border: "1px solid var(--border)",
      background: "transparent",
      color: "var(--text-muted)",
      cursor: "pointer",
    }}
  >
    <X size={10} /> Cancel
  </button>
)}
```

Import `X` from `lucide-react` alongside existing imports.

c) Listen for a new `cortex://draft/aborted` event. On receipt, clear
   `drafting` state, `currentDraftId`, and show a transient error message
   via the existing `setError` state: "Draft cancelled by you."

d) Clear `currentDraftId` on `cortex://draft/completed` and
   `cortex://draft/error` too.

**Frontend constraints (see CLAUDE.md):**
- NO oklch, NO color-mix, NO Tailwind v4 color classes
- Inline styles + CSS variables with hex values
- The cancel button MUST follow the style idiom of the other PlansPanel buttons

### 5. Unit tests

Add to `src-tauri/src/commands/plans.rs` tests module:

- `test_abort_draft_removes_from_active_drafts` — insert a stub into
  active_drafts, call abort_draft, verify it's removed. (You can't
  actually kill a real process in a unit test; just verify the state
  mutation.) If the AsyncMutex makes this awkward, skip the test and
  add a TODO comment explaining why.

Actually — if integration testing active_drafts from a unit test is too
invasive, it's acceptable to skip new tests for this feature and rely on
the regression guards already in place for execute.rs. Make a judgment call.
Prefer NO flaky tests over brittle ones.

## Verification

1. `cargo check --workspace` clean
2. `cargo test --workspace` all passing
3. `bun run build` clean
4. No new warnings in either build
5. `git diff --stat` touches only the 4 files listed above (state.rs,
   commands/plans.rs, lib.rs, PlansPanel.tsx) — if other files are modified,
   something went wrong
6. The frontend code follows Safari 15 compat rules (grep your changes for
   `oklch`, `bg-[red-green-blue]-[0-9]`, `(?<=`, `(?<!` — all should be empty)
7. `grep -rn "--include-hook-events" src-tauri/src/` should be empty (the
   existing regression guard will catch you if you accidentally re-added it)

## Report format

```
ABORT_DRAFT STATUS: DONE | BLOCKED

Files modified:
- <path 1>
- <path 2>
...

Tests added: <count>
Tests passing: <before> → <after>

Frontend violations found: <list, should be empty>

Manual verification needed from the human:
- Start a draft via the ✨ button with a long prompt
- Click the new Cancel X
- Verify: status clears, no zombie claude process (`ps aux | grep "claude --print"`)
```
