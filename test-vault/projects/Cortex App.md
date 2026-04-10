---
title: Cortex App
tags: [project, cortex, active]
created: 2026-04-01
status: active
---

# Cortex App

The main project — building a development consciousness layer.

## Timeline
- **Wave 1** (Apr 8): Foundation + [[MCP Integration Guide|MCP server]]
- **Wave 2** (Apr 8): [[CodeMirror 6]] editor + vault manager
- **Wave 3** (Apr 8): [[Knowledge Graph]] + [[Tantivy]] search + backlinks
- **Wave 4** (Apr 8): [[D3.js]] graph visualization + context capture
- **Wave 5** (Apr 8): Voice integration from [[Handy App]]
- **Wave 6** (Apr 8): Claude Code skill + themes + rich content

## Key Decisions
- [[Decision - Tauri vs Electron]]
- [[Decision - CodeMirror vs ProseMirror]]
- [[Decision - MCP vs Custom API]]
- [[Decision - Tantivy vs Meilisearch]]

## What We Learned
- [[Pattern - Parallel Agent Teams]] was the key to velocity
- [[Pattern - Self-Bootstrapping]] proved the concept
- [[Pattern - MCP as Integration Layer]] is the right abstraction

## Tech Debt
- Voice transcription is stubbed (needs [[transcribe-rs]] integration)
- Search index only builds on vault open (should be incremental)
- No offline model download progress

See [[Architecture Overview]] for technical details.

#project #cortex
