---
title: "Decision: Tauri vs Electron"
tags: [decision, architecture, framework]
created: 2026-04-01
type: decision
status: decided
---

# Decision: Tauri vs Electron

## Context
Needed a cross-platform desktop framework for [[Cortex App]].

## Options
1. **Electron** — Proven, huge ecosystem, but 200MB+ bundle, high memory
2. **Tauri 2.x** — Rust backend, native webview, 10MB bundle, lower memory
3. **Flutter** — Good for mobile, desktop support immature

## Decision
**Tauri 2.x** — Rust backend gives us native performance for [[Tantivy]] search, audio processing ([[Handy App]] extraction), and the [[MCP Integration Guide|MCP server]].

## Consequences
- Must learn Rust (acceptable, team has experience)
- Smaller ecosystem than Electron
- Safari 15 WKWebView quirks on macOS (see [[Pattern - Safari 15 Compatibility]])
- Can reuse Handy's Rust audio crates directly

#decision #architecture
