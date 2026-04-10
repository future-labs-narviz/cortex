---
title: Architecture Overview
tags: [architecture, cortex, tauri]
created: 2026-04-02
---

# Architecture Overview

Cortex uses a **Tauri 2.x** architecture with four Rust crates:

## Crate Structure
- `cortex-core` — Vault management, file watching via [[notify crate]]
- `cortex-search` — Full-text search via [[Tantivy]]
- `cortex-graph` — Link indexing, backlinks, [[Knowledge Graph]]
- `cortex-voice` — Audio recording, extracted from [[Handy App]]

## Frontend Stack
- React 18 + TypeScript
- [[CodeMirror 6]] for the editor
- [[D3.js]] for the knowledge graph
- Zustand for state management

## Key Decision
We chose Tauri over Electron because of [[Decision - Tauri vs Electron]].

The [[MCP Integration Guide]] explains how the backend connects to Claude Code.

See also: [[Pattern - Parallel Agent Teams]] for how we built this.

#architecture #technical
