---
title: Decision Index
created: 2026-04-10T09:40:33
modified: 2026-04-10T09:40:33
tags: 
  - decision
  - index
  - architecture
  - summary
---

# Decision Index

# Decision Index

A summary of all architectural and technical decisions made in this vault.

## Decisions

- **[[Decision - Tauri vs Electron]]** — Chose Tauri 2.x for its lighter footprint and Rust backend over Electron
- **[[Decision - CodeMirror vs ProseMirror]]** — Chose CodeMirror 6 as the note editor
- **[[Decision - Tantivy vs Meilisearch]]** — Chose Tantivy for full-text search, embedding directly in the Tauri process
- **[[Decision - MCP vs Custom API]]** — Chose MCP as the integration layer for connecting to Claude Code
- **[[Decision - JWT vs Sessions]]** — Started with JWT, later switched to session-based auth

## Referenced but not yet documented

- **[[Decision - Idempotency]]** — Referenced in [[Payment System]] for retry-safe webhook handling

