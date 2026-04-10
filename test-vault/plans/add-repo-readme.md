---
type: plan
title: "Add README.md at repo root — quickstart, architecture, feature tour"
status: ready
goal: "Create ~/Desktop/Cortex/README.md so someone cloning the repo for the first time has a working mental model and a copy-pasteable quickstart. Covers prereqs, dev mode, feature tour (Phase A + B + KG + voice), architecture, the 3 LLM auth contexts, and contributing notes. <= 350 lines."
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash(ls *)", "Bash(find *)", "Bash(wc *)"]
denied_tools: ["Bash(rm *)", "Bash(git push *)", "Bash(git commit *)"]
context_entities: []
context_notes:
  - "Architecture Overview.md"
  - "MCP Integration Guide.md"
  - "patterns/Pattern - MCP as Integration Layer.md"
model: claude-sonnet-4-5
max_turns: 20
max_budget_usd: 2
permission_mode: acceptEdits
worktree: false
---

# Add repo-level README.md

## Why this plan exists

Cortex has no README.md at the repo root. Cloning the project gets you a
folder full of Rust + TypeScript with no orientation. This plan writes a
single README that tells a newcomer:
1. What Cortex is (30 seconds)
2. How to run it (5 minutes)
3. What it can do (feature tour)
4. How it's structured (architecture)
5. How to contribute (conventions)

The `CLAUDE.md` plan (`plans/add-claude-md.md`) may or may not have been
executed first. Either way, if you're doing this plan, check whether
`~/Desktop/Cortex/CLAUDE.md` exists — if so, link to it from the README
as "project conventions for Claude Code sessions".

## Exact scope

Create exactly one file: `~/Desktop/Cortex/README.md` (repo root).

Do NOT create CHANGELOG.md, CONTRIBUTING.md, LICENSE, or any other file.
Do NOT modify any existing file unless a trivial typo fix is needed for
accuracy.
Do NOT commit. (Human reviews before commit.)

## Required sections (in this order)

### 1. Title + tagline
```
# Cortex

> Your development consciousness layer — a Tauri knowledge-graph app that
> captures interactive Claude Code sessions and lets you execute + draft
> plans against a typed knowledge graph.
```

### 2. Screenshots placeholder
A single `## Screenshots` section with a note like "TODO: add screenshots of
Plans panel, live session view, graph view, drafting flow". Don't attempt
to add real screenshots.

### 3. Quickstart
```bash
# Prereqs
# - Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# - Bun: curl -fsSL https://bun.sh/install | bash
# - Claude Code CLI with Max plan login: `claude setup`
# - (Optional) Vertex AI credentials for retrospectives — see below

# Clone + install
git clone https://github.com/future-labs-narviz/cortex.git ~/Desktop/Cortex
cd ~/Desktop/Cortex
bun install

# (Optional) Vertex credentials for cortex-extract
cp .env.example .env   # or: nano .env, add GCP_SERVICE_ACCOUNT_JSON + GCP_PROJECT_ID

# Run dev mode
bun run tauri dev

# Then Cmd+O → pick test-vault/ to explore the committed sample vault
```

Describe what the user should see on first open: Plans panel has the
fixture `2026-04-09-add-readme.md`, Sessions panel has ~11 past sessions,
KG has 48 entities. The fixture plan can be Executed to smoke-test
Phase B.

### 4. Feature tour (one subsection per major surface)

- **Vault file explorer** — file tree, rename/delete/new, right-click context menu
- **Markdown editor** — CodeMirror 6, edit/preview/split toolbar, live wikilinks
- **Full-text search** — Tantivy index at `.cortex/search-index/`
- **Backlinks + tags panels** — both pop out to full sheet
- **Typed knowledge graph view** — D3 force layout, two layers (wikilinks + typed KG entities), click to see entity profile
- **Daily notes + calendar**
- **Voice notes** — record in-app, transcribe via `cortex-voice`, note created in `voice-notes/`
- **Phase A auto-capture** — hooks in `<vault>/.claude/settings.json` fire on every `claude` session; session notes + Vertex-generated retrospectives land in `sessions/`; KG grows automatically
- **Phase B execute** — Plans panel (▶), click a `type:plan` note, Execute, watch the live stream, retrospective appears on completion
- **Phase B draft** — ✨ button in Plans panel, type a goal, `claude --print --permission-mode plan` drafts a plan with KG-aware context and routes you to plan-runner
- **MCP server** — `127.0.0.1:3847/mcp` exposes `cortex_*` tools to any claude session configured via `.mcp.json`

### 5. The three LLM auth contexts

Lift directly from CLAUDE.md if it exists, or write from scratch. Must cover:

| Context | Auth | Used by |
|---|---|---|
| Interactive Claude Code | Max plan OAuth keychain | Phase A hook-driven capture loop |
| `cortex-extract` background | Vertex AI via SA JSON | Post-session retrospective + KG entity extraction |
| Phase B execute/draft | Max plan OAuth keychain | Spawned `claude --print` via tauri-plugin-shell |

Emphasize that Vertex is **optional** — Phase A + B still work without it,
you just lose retrospectives and KG growth.

Link to `.env.example` (create it if missing — see step 8 below) for the
Vertex setup.

### 6. Architecture (short)

Rust workspace with 6 crates + Tauri app. Crate purposes in one line each:
- `cortex` — Tauri app, MCP HTTP server, Phase B run orchestrator
- `cortex-core` — vault I/O, frontmatter parsing, file watcher
- `cortex-search` — Tantivy FTS
- `cortex-graph` — link index, backlinks
- `cortex-kg` — typed knowledge graph
- `cortex-voice` — audio + transcription
- `cortex-extract` — Vertex AI extraction job

Frontend: React 18 + TypeScript, CodeMirror 6, D3, Zustand. Inline styles +
CSS variables with hex values (Safari 15 WKWebView constraint — link to
CLAUDE.md or the pattern note).

Phase B plan lifecycle (ASCII diagram, 4 stages):
```
plan note (draft) → plan-runner view → execute_plan spawn → live session view
                                                                   ↓
                      plan note (complete) ← session note + retrospective + KG
```

### 7. Development conventions (short)

Bullet list, 5-8 items. Must include:
- Parallel agent teams with file-disjoint work units
- `cargo check --workspace` + `bun run build` between every meaningful change
- Safari 15 WKWebView constraint for frontend (see CLAUDE.md)
- Phase B `claude` spawn flag rules (see CLAUDE.md — do not re-add `--include-hook-events`)
- Plans live in `<vault>/plans/*.md` with `type: plan` frontmatter
- Prefer writing plan notes for multi-step work so fresh sessions can execute them (self-bootstrapping pattern)

Link to CLAUDE.md at the top of this section with something like "Claude
Code sessions auto-load conventions from CLAUDE.md at the repo root."

### 8. Contributing (short)

Minimum: "PRs welcome. Before submitting, run `cargo test --workspace` and
`bun run build`. See CLAUDE.md for project conventions." Don't write a full
CONTRIBUTING.md — just a pointer.

### 9. License (placeholder)

```
## License

TODO: add a LICENSE file.
```

## Additional side task

If `~/Desktop/Cortex/.env.example` does not exist, create it with:

```bash
# Vertex AI credentials for cortex-extract (optional).
# Without these, Phase B runs still execute but no retrospectives are
# generated and the knowledge graph does not grow from session history.
GCP_SERVICE_ACCOUNT_JSON=
GCP_PROJECT_ID=
```

Do NOT put real credentials in this file — empty placeholders only.

## Verification

1. `ls ~/Desktop/Cortex/README.md` exists
2. `wc -l README.md` is between 150 and 350 lines
3. All file paths mentioned in the README exist on disk — verify with `ls` or `Read`
4. `.env.example` exists at repo root
5. No real credentials anywhere in either file
6. `cargo check --workspace` still passes
7. `bun run build` still passes
8. Open README.md in an editor and skim for typos / broken markdown

Report DONE with: README line count, `.env.example` status (created/already existed), and a list of any file paths you mentioned that don't exist (should be empty).
