# Phase B — Verified State (2026-04-09, v2)

This document captures everything verified about Claude Code's spawn-and-stream API before Phase B planning begins. Same shape as `session-3-build-spec.md`'s Verified State section: it is the **current source of truth** for Phase B. Anything in `session-1-output.md` that conflicts with this is superseded.

Phase B is the orchestrator layer: a `type: plan` note becomes executable, Cortex spawns `claude` with a per-run context bundle, streams stdout into a live "session" sheet, and the existing `cortex-extract` job runs on the resulting transcript.

> **v2 changes from v1 (the same day):** v1 assumed Vertex AI was the only auth path for spawned `claude`. v2 corrects this — the user is on a Claude **Max plan**, so spawned `claude` uses **OAuth via the system keychain** (`authMethod: claude.ai`, `apiProvider: firstParty`, `subscriptionType: max`). $0 cost. Vertex moves to a future "custom TUI harness" track.

---

## ✅ Hard gate: spawning Claude Code from Cortex works

Verified 2026-04-09 from this machine. Output: `MAX PLAN OK`. Cost: $0 (Max plan unlimited; reported cost field is informational only). Model: `claude-sonnet-4-5@20250929` (default — overridable via `--model`).

The hard gate command (verbatim, **with no GCP/Vertex env**):

```bash
TEST_ID="$(uuidgen | tr 'A-Z' 'a-z')"
claude --print --setting-sources user \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --max-turns 1 \
  --session-id "$TEST_ID" \
  -p "Reply with exactly: MAX PLAN OK"
```

The spawned process uses the Max plan OAuth tokens stored in the user's macOS keychain (`authMethod: claude.ai`, `apiProvider: firstParty`). No env translation, no SA file, no `--bare`.

---

## Auth strategy: TWO eras for Phase B

### Phase B v1 (this build): Max plan via spawned `claude`

Spawn `claude --print --setting-sources user --strict-mcp-config --mcp-config <per-run> ...`. Inherit the parent process's env. **Do not set any GCP/Vertex env vars.** **Do not pass `--bare`.** OAuth keychain auth picks up the user's Max plan automatically.

Why this is the right v1:
- $0 cost (Max plan covers it)
- No env translation needed
- No SA temp file shuffle
- Same auth path the user's normal interactive `claude` already uses
- Stream-json works identically to `--bare` mode (with 2 minor extra event types — see taxonomy below)

### Phase B future: custom TUI harness via Vertex

When Cortex grows its own claude-code-like TUI wrapper (so Cortex can run arbitrary models — Claude variants OR other models — through Vertex), Vertex becomes the primary path for the *orchestrator's own model calls*. At that point Phase B's spawn step is replaced by direct LLM calls, and the env translation table from v1 of this doc applies. **Do not preemptively wire Vertex into Phase B v1.**

The `cortex-extract` background job (Phase A item #4) already uses Vertex AI directly via the SA JSON in `~/Desktop/Cortex/.env`. That's separate from Phase B and stays as-is. Three LLM contexts coexist in Cortex:

| Context | Auth | When | Where |
|---|---|---|---|
| 1. Interactive Claude Code (user-driven) | Max plan OAuth keychain | User types `claude` in a terminal | Any cwd, including Cortex vault dirs |
| 2. `cortex-extract` (background) | Vertex AI via SA JSON | Post-session, fires from `handle_hook_session_end` | Inside Cortex Rust process, no Claude Code involved |
| 3. **Phase B `execute_plan` (orchestrator)** | **Max plan OAuth keychain** (via spawned `claude`) | User clicks Execute on a `type:plan` note | Spawned via tauri-plugin-shell from Cortex.app |

**Do not conflate these.** Phase B v1's only LLM auth path is #3 — Max plan via spawned process. Vertex is reserved for #2 (existing) and the future custom-harness era.

---

## The hook-recursion trap and how `--setting-sources user` solves it

The Phase A hooks live in `<vault>/.claude/settings.json` (project-level). Spawning `claude` from inside a Cortex vault would re-fire those hooks → infinite loop where Phase B's session triggers Phase A's auto-capture which Phase B already handles directly.

**The fix:** `--setting-sources user`. Claude Code's `--setting-sources` flag accepts a comma-separated list of `user`, `project`, `local`. The default loads all three. Passing `--setting-sources user` loads ONLY `~/.claude/settings.json` (statusline, plugins, OAuth keychain settings) and skips:
- `<vault>/.claude/settings.json` ← where Cortex's Phase A hooks live ✓ skipped
- `<vault>/.claude/settings.local.json` ← user-local overrides ✓ skipped

**Verified empirically** on 2026-04-09: spawned `claude --setting-sources user ... -p "..."` from inside `~/Desktop/Cortex/test-vault/`, the session note count in `vault/sessions/` did NOT increase. Phase A's hooks were not invoked.

**Why not `--bare`?** `--bare` definitively skips hooks (verified in source: `~/Desktop/Handy/claude-code-leaked/src/setup.ts:319` "executeHooks early-returns under --bare anyway"), BUT `--bare` also explicitly disables OAuth and keychain reads (per its own help text: "OAuth and keychain are never read"). So `--bare` is incompatible with Max plan auth. `--setting-sources user` is the right tool: it bypasses project-level hook config without disabling OAuth.

---

## CLI flags — verified against the leaked source

All flags verified against `~/Desktop/Handy/claude-code-leaked/src/main.tsx` (the `program.option(...)` chain starting at line 968) and `claude --help` from binary `2.1.97` at `/Users/jamq/.local/bin/claude`.

### The Phase B v1 spawn command template

```
claude --print --verbose
       --setting-sources user
       --strict-mcp-config --mcp-config <path-or-inline-json>
       --output-format stream-json --include-partial-messages --include-hook-events
       --max-turns <N>
       --max-budget-usd <amount>
       --permission-mode <mode>
       --model <alias-or-id>
       --session-id <uuidv4>
       --append-system-prompt-file <context-bundle.md>
       --add-dir <vault-root>
       [--allowedTools <tools...> | --disallowedTools <tools...>]
       [--worktree]
       -p "<the-task-text>"
```

### Visible flags (in `--help`)

| Flag | Notes |
|---|---|
| `-p, --print` | **Required.** Headless print mode. Skips workspace trust dialog. |
| `--verbose` | **Required when streaming.** Without it, `--print --output-format=stream-json` errors out: `When using --print, --output-format=stream-json requires --verbose`. |
| `--output-format <text\|json\|stream-json>` | Use `stream-json` for live transcript. |
| `--include-hook-events` | Include hook lifecycle in stream. Only with `stream-json`. Useful for telemetry; user-level plugin hooks WILL fire under v1. |
| `--include-partial-messages` | Token-level deltas. Only with `--print` + `stream-json`. **Required for live token streaming.** |
| `--mcp-config <configs...>` | Accepts file paths or inline JSON, space-separated. Cortex writes per-run `.mcp.json`, passes path. |
| `--strict-mcp-config` | **Required.** Without it, the user's MCP servers leak in even with explicit `--mcp-config`. |
| `--allowedTools, --allowed-tools <tools...>` | From plan's `allowed_tools` frontmatter. |
| `--disallowedTools, --disallowed-tools <tools...>` | From plan's `denied_tools` frontmatter. |
| `--tools <tools...>` | Alternative to allowedTools — `""` disables all, `"default"` enables built-in set. |
| `--permission-mode <mode>` | Choices: `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, `plan`. From plan frontmatter; default `acceptEdits`. |
| `--model <model>` | Alias (`sonnet`, `opus`, `haiku`) or full ID. From plan frontmatter. |
| `--session-id <uuid>` | **Must be a valid UUIDv4.** Cortex generates `cortex_run_id` as UUIDv4. Lets Cortex correlate the spawned run with its own state and find the JSONL transcript afterwards. |
| `--add-dir <directories...>` | Additional directories to allow tool access to. From plan frontmatter `context_dirs`. |
| `--setting-sources <sources>` | **Critical for Phase B v1.** Pass `user` to skip the vault's project-level settings.json (where Phase A hooks live). Without this, Phase B recurses into Phase A. |
| `-w, --worktree [name]` | Create a new git worktree for the session. From plan frontmatter `worktree: true`. |
| `--no-session-persistence` | **Do NOT set this in v1.** Cortex needs the JSONL transcript on disk for the post-run extraction step to read. |

### Hidden flags (`.hideHelp()` in source, but exist)

| Flag | Source line | Phase B usage |
|---|---|---|
| `--max-turns <turns>` | `main.tsx:976` | From plan frontmatter `max_turns`. Only works with `--print`. |
| `--max-budget-usd <amount>` | (visible) | From plan frontmatter `max_budget_usd`. Validated > 0. Only with `--print`. **NOTE: under Max plan this is informational; the user isn't charged.** Still useful as a guardrail to bound runaway runs. |
| `--system-prompt-file <file>` | `main.tsx:976` | Optional alternative to `--system-prompt`. |
| `--append-system-prompt-file <file>` | `main.tsx:976` | **The flag Phase B needs.** Reads text from a file and appends to the default system prompt. Cortex writes the per-run KG context bundle to `/tmp/cortex-run-<id>/context.md` and passes that path. |

### Behavior gotchas

- `--print` + `--output-format=stream-json` **requires** `--verbose`. Without it: error `When using --print, --output-format=stream-json requires --verbose`.
- `--include-partial-messages` **requires** `--print` AND `--output-format=stream-json`. Otherwise silently does nothing.
- `--include-hook-events` **requires** `--output-format=stream-json`. Silently does nothing in text/json mode.
- `--max-budget-usd`, `--max-turns`, `--no-session-persistence` only work with `--print`.
- `--session-id` must be a valid UUIDv4 — Claude Code rejects non-UUID strings.
- `--mcp-config` accepts space-separated configs; pass either a file path or inline JSON. **Inline JSON works** (`'{"mcpServers":{}}'`).
- `--strict-mcp-config` is the only way to guarantee user MCP servers don't leak in. **Always set it for Phase B.**
- `--setting-sources user` is the **only** way to bypass vault hooks while keeping OAuth working. `--bare` would also bypass them but kills OAuth.
- Spawned process MUST inherit the parent env unchanged. Specifically: any keychain-related env vars (e.g. `HOME`, `USER`, `LOGNAME`) and the OAuth helper paths must come through. Tauri's `tauri-plugin-shell` defaults to inheriting parent env via Rust `Command`, so this should work for free — **verify during Phase B build.**

---

## stream-json event taxonomy (verified under Max plan)

Captured from a real `claude --print --verbose --setting-sources user --strict-mcp-config --mcp-config '{"mcpServers":{}}' --output-format stream-json --include-partial-messages --include-hook-events --max-turns 1 -p "..."` run on 2026-04-09. Each line of stdout is one JSON object.

### Event types observed

| Event shape | When emitted | What Phase B should do |
|---|---|---|
| `{"type":"system","subtype":"init",...}` | First event. Includes `cwd`, `session_id`, `tools`, `mcp_servers`, `model`, `permissionMode`, `slash_commands`, `apiKeySource`, `claude_code_version`, `plugins`, `agents`, `skills`, `uuid`, `fast_mode_state` | Emit `cortex://session/started` Tauri event with the session_id (lets the live "session" sheet bind to it). |
| `{"type":"system","subtype":"hook_started",...}` | **Max plan path only.** Fires when a user-level plugin hook starts. Vault hooks don't fire because of `--setting-sources user`, but plugin hooks (e.g. statusline, superpowers SessionStart) still do. | Phase B can ignore these or surface them as a "hook ran" badge in the live sheet. |
| `{"type":"system","subtype":"hook_response",...}` | **Max plan path only.** Fires when a user-level plugin hook completes. | Same — informational. |
| `{"type":"stream_event","event":{"type":"message_start","message":{...}},...}` | Beginning of an assistant response. | Open a new message bubble. |
| `{"type":"stream_event","event":{"type":"content_block_start","index":N,"content_block":{"type":"thinking"\|"text"\|"tool_use",...}}}` | New content block. | Open a new block in the message bubble. |
| `{"type":"stream_event","event":{"type":"content_block_delta","index":N,"delta":{"type":"thinking_delta"\|"text_delta"\|"signature_delta"\|"input_json_delta",...}}}` | Token delta. Shape varies: text uses `text`, thinking uses `thinking`, tool calls use `partial_json`. | Append to live block. **This is the streaming source for the live transcript view.** |
| `{"type":"stream_event","event":{"type":"content_block_stop","index":N}}` | End of content block. | Mark block complete. |
| `{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":...,"stop_sequence":...},"usage":{...}}}` | Message about to end; final usage. | Update message metadata. |
| `{"type":"stream_event","event":{"type":"message_stop"}}` | Message complete. | Close message bubble. |
| `{"type":"assistant","message":{...},"session_id":...,"uuid":...}` | Full message snapshot — emitted between `content_block_stop` events. | Use this as canonical "what was the final text" source. |
| `{"type":"rate_limit_event",...}` | **Max plan path only.** Rate limit headroom info from Anthropic API. | Surface as a non-blocking warning in the live sheet if approaching limit. |
| `{"type":"result","subtype":"success"\|"error",...}` | **Final event.** Includes `duration_ms`, `duration_api_ms`, `num_turns`, `result` (string), `stop_reason`, `total_cost_usd`, `usage`, `modelUsage`, `permission_denials`, `terminal_reason`. | Emit `cortex://session/completed`. Update plan note status to `complete`. **Then call `cortex_extract::extraction_job` directly** — the Stop hook does NOT fire under `--setting-sources user` for vault hooks. |

### Critical design implication

**Under `--setting-sources user`, Cortex's vault-level Stop hook does NOT fire when a Phase B run completes.** This means the Phase A auto-extraction will NOT run automatically for Phase B-spawned sessions.

Phase B's `execute_plan` Tauri command MUST manually trigger `cortex_extract::extraction_job` when it sees the `result` event. Otherwise the loop doesn't close and no retrospective is written.

The transcript path is deterministic from the cwd + session_id. Claude Code writes the JSONL to `~/.claude/projects/<slug>/sessions/<session_id>.jsonl` (verify the slug derivation during the build — it's likely `cwd.replace('/', '-')` lowercased). Phase B can read it directly OR collect the transcript in-memory from the stream events and pass it to extraction_job that way (faster, no race).

### 13 events for a 1-turn 7-token reply

Distribution observed:
- 1 `system/init`
- 1 `system/hook_started` + 1 `system/hook_response`
- 1 `stream_event/message_start`
- 1 `stream_event/content_block_start` + 2 `stream_event/content_block_delta` + 1 `content_block_stop`
- 1 `stream_event/message_delta` + 1 `stream_event/message_stop`
- 1 `assistant` (full snapshot)
- 1 `rate_limit_event`
- 1 `result`

A real 30-turn run with mixed tool use will have hundreds of events. Phase B's stream parser must be a streaming line reader, not a "load all then parse" approach.

---

## What does NOT work / common gotchas

- **Setting any GCP/Vertex env vars on the spawned process under v1.** Don't. The user is on Max plan; Vertex is the future-harness path. Setting `CLAUDE_CODE_USE_VERTEX=1` would silently switch the spawn to Vertex billing.
- **Forgetting `--verbose` with stream-json:** errors immediately. Always pair `--print --verbose --output-format stream-json`.
- **Forgetting `--setting-sources user`:** Phase B silently recurses into Phase A's hooks → infinite session loop.
- **Forgetting `--strict-mcp-config`:** the user's MCP servers (postgres, fal-ai, swift-lsp, superpowers, context7, rust-analyzer-lsp) leak in. Phase B's allowlist becomes meaningless.
- **`--session-id` non-UUID:** Cortex must use the `uuid` crate (already in workspace deps) and generate UUIDv4.
- **Stop hook skipped under `--setting-sources user`:** Phase B's `execute_plan` must manually trigger `cortex_extract::extraction_job` post-run.
- **Inline SA JSON in `GOOGLE_APPLICATION_CREDENTIALS`:** moot for v1 (we don't use Vertex), but if you ever do — that env var is a path, not a JSON string. Write to a temp file first.
- **Direct Anthropic API on this user's account:** balance is zero (verified 2026-04-09 returning `credit_balance_too_low`). Max plan OAuth path bypasses this entirely; do not fall back to `ANTHROPIC_API_KEY`.

---

## Cost reference

Both runs were 1-turn, ~7 token output, on `claude-sonnet-4-5@20250929`:

| Auth path | Reported `total_cost_usd` | Actual user cost |
|---|---|---|
| Vertex AI (v1 spike) | $0.004 (with cache hits) | $0.004 (billed to GCP project) |
| Max plan OAuth (v2, current) | $0.071 (cold cache) | **$0** (Max plan unlimited) |

The reported cost field on Max plan is API-equivalent, not actual billing. Phase B's UI should show it as "estimated equivalent cost (Max plan covers)" not "this run cost you $X". A 30-turn real run is estimated $0.50–$5.00 equivalent — informational only under Max plan.

---

## What's still uncertain (Phase B build must verify)

These are NOT blockers but should be confirmed during the Phase B build, before parallel team dispatch:

1. **`tauri-plugin-shell` env inheritance from a Finder-launched Cortex.app.** Rust's `Command::new()` inherits parent env by default, but: under macOS, a Finder-launched .app starts with a barebones env (no shell exports — the R3b problem). Cortex must use `dotenvy::from_path` to load `~/Desktop/Cortex/.env` at startup (already done for Phase A). For Phase B: does the spawned `claude` inherit access to the macOS keychain? OAuth tokens live in keychain, which is per-user not per-process. **Test:** spawn `claude --print -p "test"` from inside the running Cortex.app via tauri-plugin-shell, see if it returns "test" or an auth error.
2. **JSONL transcript path resolution.** Is it `~/.claude/projects/<slug>/sessions/<session_id>.jsonl` or something else? **Test:** spawn one real session, `find ~/.claude/projects -name "<session_id>*"` after.
3. **Project slug derivation from cwd.** Likely `cwd.replace('/', '-')` lowercased. **Test by inspection.**
4. **`--worktree` behavior under `-p` mode.** Does it actually create a worktree or get ignored in print mode? **Test it.**
5. **stdout vs stderr split.** Does Claude Code emit stream-json on stdout AND human-readable progress on stderr? Phase B's spawn must capture both. **Test:** redirect stderr separately and inspect.
6. **SIGTERM cleanup semantics.** If Cortex needs to abort a run mid-stream, does `kill(SIGTERM)` cleanly tear down the spawned `claude`? **Test:** start a long-running spawn, kill after 2s, verify no zombies.
7. **Plugin SessionStart hook firing.** Under `--setting-sources user`, the user's plugins (superpowers, postgres-best-practices, etc.) WILL still fire SessionStart hooks. Verify this isn't a problem — Phase B doesn't want extraneous tool calls polluting the transcript. If it is, an additional flag like `--no-plugins` (if it exists) might help. Otherwise live with it; user-level plugin hooks are part of the user's environment.
8. **Stream parser robustness:** does `tool_use` show up at `content_block_start.content_block.type == "tool_use"` only, or also as a top-level `stream_event.event.type == "tool_use"`? **Re-read `cortex-extract/src/transcript.rs` to confirm both shapes are handled.**

---

## Recommended Phase B item ordering (NOT a full spec — see Phase B planning session)

Updated from `session-1-output.md`'s items 6–10 with what the verification spike revealed:

| # | Item | Size | Pre-reqs |
|---|---|---|---|
| 6 | `tauri-plugin-shell` setup with strict allowlist (only `claude` binary, only specific arg patterns) | S | none |
| 7 | `prepare_run` Rust function (parse `type:plan` frontmatter, resolve KG entities via existing `serialize_subgraph`, write `/tmp/cortex-run-<id>/context.md`, write per-run `mcp.json`, generate UUIDv4 `cortex_run_id`, pre-write session note with status=running) | M | uses existing `cortex-kg` |
| 8 | `execute_plan` Tauri command (spawn `claude` via tauri-plugin-shell with the v1 flag template, parse stream-json line-by-line, emit Tauri events for each event type, on `result` event call `cortex_extract::extraction_job` directly with the in-memory transcript) | L | items 6, 7 |
| 9 | `session` sheet kind (live transcript view, subscribes to Tauri events from item 8, renders message bubbles + thinking blocks + tool calls) | M | item 8 |
| 10 | `plan-runner` sheet kind (renders a `type:plan` note with editable frontmatter + Execute button that fires `execute_plan`) | M | items 8 + 9 |
| 11 | Plan-status sidebar panel (lists `type:plan` notes by status: draft / ready / running / complete / failed) | S | none — separate from execution |

**Item 8 in v1 of this doc was a Vertex env translator. In v2 that item is removed entirely** — Max plan needs no env translation. Phase B is now 6 items instead of 7, and the v2 item 8 absorbs what was v1 item 9 (`execute_plan`).

**Total estimate:** 4–5 sessions if parallelized like Phase A, 6–8 if sequential. Hard dependency chain is 6 → 7 → 8; items 9/10/11 can parallel item 8 once its event shapes are locked.

---

## References

- Leaked source repo: `~/Desktop/Handy/claude-code-leaked/`
  - CLI option chain: `src/main.tsx:968-1006`
  - `--bare` semantics: `src/main.tsx:1009-1015`, `src/setup.ts:319,336`
  - `--setting-sources` handling: search `setting-sources` in main.tsx
  - Hook skip under bare: `src/setup.ts:319` (executeHooks early-returns)
  - Vertex env handling: `src/services/api/client.ts:50-300`, `src/utils/envUtils.ts:104-180`, `src/utils/managedEnvConstants.ts:11-30` (only relevant for the future custom-harness era)
- This file: `~/Desktop/Cortex/prompts/phase-b-verified-state.md` (v2)
- Predecessors:
  - `~/Desktop/Cortex/prompts/session-1-output.md` §3.2, §3.6, §4 — original Phase B architecture
  - `~/Desktop/Cortex/prompts/session-3-build-spec.md` — Phase A spec (the shape this doc imitates)
  - `~/.claude/projects/-Users-jamq-Desktop-Cortex/memory/project_phase_b_auth_strategy.md` — the Max-plan-vs-Vertex decision rationale
  - `~/.claude/projects/-Users-jamq-Desktop-Cortex/memory/project_vertex_provider.md` — Cortex's Vertex pattern (Phase A `cortex-extract` only — NOT for Phase B v1)

---

## Next session: Phase B planning

When you start the Phase B planning session in a fresh Claude Code instance, paste this file as the first input. It supersedes session-1-output.md's Phase B section AND v1 of this same doc. The planner's job is to:

1. Read this file (v2) and `session-1-output.md` §3.2 + §4
2. Decide team boundaries (probably 3 teams: shell+prepare_run+execute_plan, sheet kinds + plan-runner UI, plan-status sidebar)
3. Write `prompts/phase-b-build-spec.md` in the same shape as `session-3-build-spec.md`
4. Include a verification sequence that exercises a real plan-to-execution-to-retrospective loop end-to-end on this machine, using the user's Max plan
