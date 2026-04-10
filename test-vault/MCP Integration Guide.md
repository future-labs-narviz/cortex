---
title: MCP Integration Guide
tags: [mcp, claude-code, integration]
created: 2026-04-03
---

# MCP Integration Guide

Cortex exposes **7 MCP tools** to Claude Code via an [[Axum]] HTTP server on port 3847.

## Available Tools
| Tool | Purpose |
|------|---------|
| `cortex/search` | Full-text search across the vault |
| `cortex/capture` | Save insights and decisions |
| `cortex/get-context` | Get relevant context for a topic |
| `cortex/list-related` | Find related notes |
| `cortex/list-tags` | List all tags |
| `cortex/get-note` | Read a specific note |
| `cortex/create-note` | Create a new note |

## Setup
Add to `.mcp.json`:
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

## How It Works
The MCP server runs alongside the Tauri app. See [[Architecture Overview]] for the full stack.

Claude Code's MCP client sends JSON-RPC requests. We learned from the [[Claude Code Source Analysis]] how the protocol works.

Related: [[Decision - MCP vs Custom API]], [[Pattern - MCP as Integration Layer]]

#mcp #integration #claude-code
