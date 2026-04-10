---
type: plan
title: "Live drafting view — reuse LiveSessionView for Phase B plan drafting streams"
status: ready
goal: "When the user clicks ✨ Draft in PlansPanel, instead of a static 'Drafting plan…' spinner, open a live view that streams the plan-mode spawn's events in real time (tool calls, thinking blocks, text deltas, ExitPlanMode invocation). Reuse or mirror LiveSessionView so the experience matches Phase B execution. Keep the final hand-off: when drafting completes, route to the plan-runner sheet for the new plan."
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash(cargo check *)", "Bash(cargo test *)", "Bash(bun run build*)"]
denied_tools: ["Bash(rm *)", "Bash(git push *)", "Bash(git commit *)", "Skill"]
context_entities: []
context_notes:
  - "patterns/Pattern - Safari 15 Compatibility.md"
  - "patterns/Pattern - Parallel Agent Teams.md"
model: claude-sonnet-4-5
max_turns: 30
max_budget_usd: 4
permission_mode: acceptEdits
worktree: false
---

# Live drafting view

## ⚠️ THIS PLAN SELF-MODIFIES CORTEX — DO NOT RUN VIA PHASE B AGAINST THE RUNNING DEV INSTANCE

This plan rewires `src/components/session/LiveSessionView.tsx`,
`src/lib/types/layout.ts`, `src/components/layout/Sheet.tsx`, and
`src/components/sidebar/PlansPanel.tsx` — every file it touches is
frontend code that the currently-running Cortex dev instance is
executing.

**If you try to run this plan through Phase B's ✨/Execute flow, it
will likely fail in one of several ways:**

- Vite HMR will reload the browser while your edits are mid-save
- The live drafting UI you're modifying IS the UI showing the
  drafting in progress (infinite recursion of experience)
- Any unfortunate Skill invocation (e.g. superpowers:brainstorming)
  will ask you a question and you have no way to answer

**CORRECT execution model:** open a terminal, `cd ~/Desktop/Cortex`,
run `claude` interactively. Paste this plan body or reference the
path. Phase A auto-capture still records the session + generates a
retrospective + grows the KG. You have an interactive feedback
channel for any ambiguity. See the "Phase B self-modification rule"
section of `CLAUDE.md` for the full rationale.

## Autonomous execution stanza (applies if run via Phase B anyway)

This is autonomous execution. There is no human to ask during this
run. Do NOT invoke brainstorming, planning, or any interactive
skills. Do NOT use the `Skill` tool (it's in `denied_tools` above as
a hard denial). Make decisions yourself based on the spec below. If
you encounter an ambiguity the spec doesn't cover, pick the most
conservative option and document the decision in your final report.
Implement all changes in this session; do not defer work to "next
steps" or "follow-up sessions".

## Why this plan exists

Phase B drafting (`draft_plan_from_goal`) already emits Tauri events during
the spawn:
- `cortex://draft/started` — `{ draft_id, goal, matched_entities }`
- `cortex://draft/event/<draft_id>` — one stream-json event per stdout line
- `cortex://draft/completed` — `{ draft_id, plan_path, event_count, matched_entities }`
- `cortex://draft/error` — `{ draft_id, message }`

But the frontend (`PlansPanel.tsx`) just shows a static spinner pill for
30-60 seconds. The user can't see plan mode Explore-ing their vault,
can't see thinking blocks, can't see when ExitPlanMode is being called,
and can't tell if the draft is actually progressing or stuck.

`LiveSessionView` (`src/components/session/LiveSessionView.tsx`) already
renders live stream events for Phase B execution. It handles text deltas,
thinking blocks, tool_use blocks, message snapshots, and status transitions.
This plan reuses that component (or mirrors it) for the drafting path.

## Design decision first — read before implementing

Two viable architectures. **Pick ONE** based on which is cleaner after
reading `LiveSessionView.tsx`:

### Option A — New sheet kind `draft-live`

- Add `{ kind: "draft-live"; draftId: string; goal: string }` to `SheetContent`
  in `src/lib/types/layout.ts`
- When user clicks ✨ Draft and enters a goal, immediately:
  1. Call `draft_plan_from_goal` (fire-and-forget via `invoke(...)` without
     awaiting the promise at the call site)
  2. Listen for `cortex://draft/started` to capture the `draft_id`
  3. `setSheetContent(activeSheetId, { kind: "draft-live", draftId, goal })`
- A new `LiveDraftView` component renders identical to `LiveSessionView`
  but subscribes to `cortex://draft/event/<id>` and `cortex://draft/completed`
  instead of `session/event/<id>` and `session/completed`
- On completion, read `e.payload.plan_path` and auto-route the sheet to
  `{ kind: "plan-runner", planPath }`

### Option B — Parameterize LiveSessionView

- Make `LiveSessionView` accept a `kind: "session" | "draft"` prop
- Internally, the component chooses which event channels to subscribe to
  and which termination behavior to follow
- Adds a `draft` sheet kind but reuses the same component
- Potentially cleaner if the two flows diverge little

**My recommendation: Option A.** Here's why:
- Less coupling. Draft and execute have different lifecycles (draft has
  no "abort" button initially — that's a separate plan, see `plans/add-abort-draft.md`).
- Draft terminates by routing to a DIFFERENT sheet (plan-runner), while
  execute stays put. That transition is simpler to express in a dedicated component.
- The overlap between the two components is mostly the applyEventReducer in
  `runStore.ts`, which can be reused as-is since plan-mode emits the same
  stream-json shapes Phase B execute emits.

If after reading LiveSessionView you decide Option B is cleaner, go for it —
but explain WHY in your report.

## Preconditions

- `git status` clean or only expected untracked files
- `cargo test --workspace` passing
- `bun run build` passing
- Read `src/components/session/LiveSessionView.tsx` in full before starting
- Read `src/stores/runStore.ts` in full before starting
- Read `src/components/sidebar/PlansPanel.tsx` in full before starting
- Read `src-tauri/src/commands/plans.rs::draft_plan_from_goal` in full
  (specifically the event emission sites) before starting

## Required changes (assuming Option A)

### 1. `src/lib/types/layout.ts` — new sheet kind

Add to the `SheetContent` discriminated union:
```ts
| { kind: "draft-live"; draftId: string; goal: string }
```

### 2. `src/components/session/LiveDraftView.tsx` — new component

Copy `LiveSessionView.tsx` as a starting point, then:

- Rename to `LiveDraftView`, same file in the same directory
- Remove the replay-from-JSONL effect (drafts don't persist a JSONL
  artifact; the final result is the plan note itself)
- Change subscriptions:
  - `cortex://session/event/${runId}` → `cortex://draft/event/${draftId}`
  - `cortex://session/completed` → `cortex://draft/completed`
  - `cortex://session/error` → `cortex://draft/error`
  - (drop the `session/aborted` subscription — no abort support in v1;
    the separate `plans/add-abort-draft.md` plan adds it later)
- Change the completion handler: instead of staying put, read
  `e.payload.plan_path` and call
  `layout.setSheetContent(sheetId, { kind: "plan-runner", planPath: e.payload.plan_path })`
- Header should show "DRAFTING" status pill, goal text, and event count.
  No retrospective button. No abort button (yet).
- When `currentDraftId` is null (event hasn't fired yet), show a simple
  "Spawning plan-mode claude…" placeholder
- Frontend style: inline styles, CSS vars with hex values (Safari 15 rule).
  Mirror the styling of LiveSessionView exactly.

### 3. `src/components/layout/Sheet.tsx` — route the new kind

Add a `case "draft-live":` branch in the `SheetContent` switch that renders
`<LiveDraftView draftId={...} goal={...} sheetId={sheetId} />`. Import the
new component at the top.

### 4. `src/components/sidebar/PlansPanel.tsx` — switch to sheet-based flow

Current code awaits `draft_plan_from_goal` before transitioning sheets.
Change to:

```ts
const submitDraftPlan = useCallback(async () => {
  if (!draftGoal.trim()) return;
  setShowDraftInput(false);
  setError(null);
  const goal = draftGoal.trim();
  setDraftGoal("");

  // Listen once for draft/started to capture the draft_id, then route
  // the active sheet to the live draft view.
  let startedUnlisten: (() => void) | null = null;
  try {
    startedUnlisten = await listen<{ draft_id: string }>(
      "cortex://draft/started",
      (e) => {
        const layout = useLayoutStore.getState();
        layout.setSheetContent(layout.activeSheetId, {
          kind: "draft-live",
          draftId: e.payload.draft_id,
          goal,
        });
        startedUnlisten?.();
      }
    );
    // Fire the Tauri command. We do NOT await the promise — the backend
    // emits /started almost immediately, and the final route-to-plan-runner
    // happens from inside LiveDraftView on /completed.
    invoke<string>("draft_plan_from_goal", { goal })
      .then(() => {
        void fetchPlans(); // refresh the Plans panel when drafting finishes
      })
      .catch((err) => {
        console.warn("[Cortex] draft_plan_from_goal failed", err);
        setError(`Draft failed: ${err}`);
      });
  } catch (err) {
    console.warn("[Cortex] failed to subscribe to draft/started", err);
    setError(`Draft setup failed: ${err}`);
    startedUnlisten?.();
  }
}, [draftGoal, fetchPlans]);
```

Also: remove the `drafting` state, `draftStatus` state, and the "Drafting
plan…" pill — the live view takes over that responsibility. Keep the
`showDraftInput` state and inline input unchanged.

The ✨ button remains as the entry point but no longer needs a loading
spinner on itself — once the user submits the goal, the active sheet
instantly switches to the live draft view which takes over feedback.

### 5. Verify nothing regressed

- `src-tauri/src/commands/plans.rs` should NOT need any backend changes.
  The events are already being emitted.
- `runStore.ts` should NOT need any changes. LiveDraftView uses the same
  applyEventReducer via `applyEvent` as LiveSessionView.

## Frontend constraints

(Copy from CLAUDE.md if it exists, otherwise:)
- NO oklch colors
- NO color-mix
- NO Tailwind v4 color utility classes
- NO regex lookbehind in any TypeScript you write
- Inline styles for spacing, CSS variables with hex values for colors
- Reference: `src/components/sidebar/SessionsPanel.tsx`

## Verification

1. `cargo check --workspace` clean
2. `cargo test --workspace` all passing
3. `bun run build` clean with no new warnings
4. `git diff --stat` touches ONLY these files:
   - `src/lib/types/layout.ts`
   - `src/components/session/LiveDraftView.tsx` (new)
   - `src/components/layout/Sheet.tsx`
   - `src/components/sidebar/PlansPanel.tsx`
5. `grep -rnE '(oklch|color-mix|\(\?\<=|\(\?\<!)' src/components/session/LiveDraftView.tsx` should be empty
6. The regression guard `build_args_does_not_include_hook_events_flag` test still passes

## Report format

```
LIVE DRAFTING VIEW STATUS: DONE | BLOCKED

Architecture chosen: A (new sheet kind) | B (parameterize LiveSessionView)
Rationale for choice: <1-2 sentences>

Files modified:
- <path> <+lines/-lines>
...
Files created:
- <path> <total lines>

Safari 15 compat check:
- oklch: <count, should be 0>
- Tailwind color classes: <count, should be 0>
- regex lookbehind: <count, should be 0>

Tests before → after: <N> → <M>

Manual verification for the human:
- Open Cortex, open test-vault, click ✨
- Enter a goal like "Write a design doc for multi-vault switching"
- Sheet should immediately switch to the live draft view
- Should see plan-mode claude Explore the vault (Read / Glob / Grep tool blocks)
- Should see the ExitPlanMode tool call or final assistant text
- On completion, sheet auto-routes to plan-runner for the new plan
- No doubled tokens (StrictMode fix is already in place from commit 036cd63)
```
