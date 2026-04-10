---
type: session-capture
session_id: wave3-001
project: cortex
started: 2026-04-08T12:00:00Z
ended: 2026-04-08T13:30:00Z
duration: 90m
tags: [session, cortex, wave-3, search, backlinks]
---

# Session: Wave 3 — Knowledge System

**Duration:** 1h 30m | **Prompts:** 47 | **Files:** 20

## Summary
Built the complete knowledge system: wikilinks, backlinks engine, [[Tantivy]] full-text search, tag system. Wired real data into MCP tools.

## Key Decisions
- [[Decision - Tantivy vs Meilisearch]] — Tantivy embeds directly, no external service
- Regex-based wikilink parser (good enough, fast)
- Incremental index updates via file watcher events

## What Worked
- 4 parallel teams (Wikilinks, Backlinks, Search, MCP wiring) all compiled on first integration
- [[Pattern - Parallel Agent Teams]] proven at scale
- Tantivy snippet generation works great for search results

## What Failed
- TypeScript Facet types needed manual casting for CodeMirror extensions
- specta didn't like `i64` — switched to `f64` for timestamps

## Tools Used
Agent (4 parallel), Edit, Write, Bash, Grep
