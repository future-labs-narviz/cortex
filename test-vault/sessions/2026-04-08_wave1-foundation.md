---
type: session-capture
session_id: wave1-001
project: cortex
started: 2026-04-08T10:00:00Z
ended: 2026-04-08T10:45:00Z
duration: 45m
tags: [session, cortex, wave-1]
---

# Session: Wave 1 — Foundation + MCP Server

**Duration:** 45m | **Prompts:** 12 | **Files:** 15

## Summary
Built the Tauri app skeleton with Rust workspace (4 crates) and an MCP HTTP server on port 3847.

## Key Decisions
- Used [[Axum]] for the MCP server (runs in-process with Tauri)
- 4 stub MCP tools: search, capture, get-context, list-related
- `cortex/capture` tool actually writes to vault from day one

## What Worked
- Parallel teams (Rust + React) worked perfectly — no conflicts
- MCP server responded to curl on first try

## What Failed
- Initial `protocol-asset` feature flag caused build error — removed it
- Icon file needed to be a valid PNG — quick fix

## Files Created
- src-tauri/src/lib.rs, mcp.rs, state.rs, main.rs
- 4 crate skeletons (core, search, graph, voice)
- React shell with AppShell, Sidebar, StatusBar
