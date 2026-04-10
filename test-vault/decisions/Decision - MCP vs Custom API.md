---
title: "Decision: MCP vs Custom API"
tags: [decision, integration, mcp, claude-code]
created: 2026-04-03
type: decision
status: decided
---

# Decision: MCP vs Custom API

## Context
Need to connect [[Cortex App]] to Claude Code. Explored the [[Claude Code Source Analysis]] to understand integration points.

## Options
1. **MCP Server** — Standard protocol, tools + resources, future-proof
2. **Custom REST API** — More flexible but non-standard
3. **Plugin with direct tool registration** — Deepest integration but fragile
4. **Memory file writing** — Simplest but limited

## Decision
**MCP Server** (HTTP transport on port 3847) with REST API endpoints for session capture alongside.

## Why
- MCP is the standard Claude Code uses for external tools
- Supports tools, resources, and prompts
- Works with all Claude Code features (agents, teams, background tasks)
- Can be toggled on/off via config
- REST API alongside for webhook-style session capture

## Consequences
- Need to implement JSON-RPC protocol (used [[Axum]])
- 100KB max per tool result
- Can expose both tools and resources

See [[MCP Integration Guide]] for implementation details.

#decision #mcp #integration
