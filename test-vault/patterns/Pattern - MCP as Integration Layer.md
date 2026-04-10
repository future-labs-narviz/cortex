---
title: "Pattern: MCP as Integration Layer"
tags: [pattern, mcp, integration, claude-code]
created: 2026-04-08
type: pattern
---

# Pattern: MCP as Integration Layer

## Problem
Connecting external tools to AI coding assistants requires custom protocols.

## Solution
Use **Model Context Protocol (MCP)** as the standard integration layer. One protocol for tools, resources, and prompts.

## Why MCP
- Standard protocol (supported by Claude Code, potentially others)
- Supports tools (actions), resources (data), and prompts (workflows)
- HTTP transport is simple to implement
- Authentication and error handling built-in
- Can be toggled on/off via config

## Implementation in [[Cortex App]]
- [[Axum]] HTTP server on port 3847
- 7 tools exposed (see [[MCP Integration Guide]])
- REST API alongside for session capture hooks
- Learned from [[Claude Code Source Analysis]]

## Key Learning
MCP is better than a custom API because:
1. Claude Code discovers tools automatically
2. No custom client code needed
3. Future-proof as MCP evolves
4. Works with agents, teams, and background tasks

See [[Decision - MCP vs Custom API]] for the full decision record.

#pattern #mcp #integration
