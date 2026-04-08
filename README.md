# Cortex

**A development consciousness layer** — an AI-native knowledge management system that captures, connects, and resurfaces the process of building with AI.

Cortex integrates natively with [Claude Code](https://claude.ai/code) via MCP, captures development context automatically, and builds a knowledge graph of ideas → prompts → implementations → outcomes.

## What Makes Cortex Different

- **Claude Code Native** — MCP server with 7 tools + 3 resources. Search your vault, capture insights, and query context directly from Claude Code.
- **Development Session Capture** — Auto-capture Claude Code sessions as structured markdown notes with key decisions, what worked, what failed.
- **Knowledge Graph** — D3.js force-directed visualization of how your notes connect. Not just `[[wikilinks]]` — semantic connections you never made explicitly.
- **Voice-to-Text** — Record voice notes that auto-transcribe and link into the knowledge graph. Engine extracted from [Handy](https://github.com/HandyComputer/Handy).
- **Full Obsidian-Class Editor** — CodeMirror 6 with markdown, KaTeX math, Mermaid diagrams, callouts, YAML frontmatter, split panes.

## Tech Stack

- **Framework**: [Tauri 2.x](https://tauri.app/) (Rust backend + React/TypeScript frontend)
- **Editor**: [CodeMirror 6](https://codemirror.net/)
- **Search**: [Tantivy](https://github.com/quickwit-oss/tantivy) (Rust full-text search)
- **Graph**: [D3.js](https://d3js.org/) force simulation
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **MCP Server**: [Axum](https://github.com/tokio-rs/axum) HTTP on port 3847

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/)

### Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

### Connect to Claude Code

```bash
# Run the setup script
cd claude-skill && chmod +x setup.sh && ./setup.sh
```

Or manually add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "cortex": {
      "type": "http",
      "url": "http://localhost:3847/mcp"
    }
  }
}
```

Then in Claude Code:
```
/cortex search authentication
/cortex capture
/cortex why was JWT chosen over sessions
/cortex related src/auth.rs
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `cortex/search` | Full-text search across the knowledge graph |
| `cortex/capture` | Capture insights and decisions as notes |
| `cortex/get-context` | Get relevant context for a topic |
| `cortex/list-related` | Find notes related to a file or topic |
| `cortex/list-tags` | List all tags with note counts |
| `cortex/get-note` | Read a specific note |
| `cortex/create-note` | Create a new note |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+O` | Quick Switcher |
| `Cmd+P` | Command Palette |
| `Cmd+N` | New Note |
| `Cmd+D` | Daily Note |
| `Cmd+S` | Save |
| `Cmd+G` | Toggle Knowledge Graph |
| `Cmd+B` | Toggle Sidebar |
| `Cmd+\` | Split Editor |
| `Cmd+,` | Settings |
| `Cmd+Shift+R` | Voice Record |

## Architecture

```
┌──────────────────────┐       MCP Protocol       ┌──────────────────┐
│    Claude Code       │◄─────────────────────────►│     Cortex       │
│                      │  7 tools + 3 resources    │  (Desktop App)   │
│  /cortex search ...  │                           │                  │
│  /cortex capture ... │  REST API (hooks)         │  Knowledge Graph │
│                      │◄─────────────────────────►│  Voice Notes     │
│                      │  Session capture           │  Markdown Editor │
└──────────────────────┘                           └──────────────────┘
```

## Project Structure

```
cortex/
├── src/                    # React frontend (71 files)
│   ├── components/
│   │   ├── editor/         # CodeMirror 6 + extensions
│   │   ├── sidebar/        # File explorer, search, backlinks, tags
│   │   ├── graph/          # D3.js knowledge graph
│   │   ├── voice/          # Voice recording UI
│   │   ├── capture/        # Session timeline
│   │   ├── command-palette/ # Cmd+P
│   │   └── settings/       # Settings modal
│   └── stores/             # Zustand state management
├── src-tauri/
│   ├── src/                # Tauri app + MCP server
│   └── crates/
│       ├── cortex-core/    # Vault management, file watching
│       ├── cortex-search/  # Tantivy full-text search
│       ├── cortex-graph/   # Link indexing, backlinks, graph data
│       └── cortex-voice/   # Audio recording (from Handy)
└── claude-skill/           # Claude Code integration
    ├── SKILL.md            # /cortex skill definition
    ├── .mcp.json           # MCP server config
    └── agents/             # Custom agent definitions
```

## License

MIT
