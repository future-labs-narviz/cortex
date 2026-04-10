---
title: "Decision: Tantivy vs Meilisearch"
tags: [decision, search, rust]
created: 2026-04-03
type: decision
status: decided
---

# Decision: Tantivy vs Meilisearch

## Context
[[Cortex App]] needs full-text search. Must run locally (no external service).

## Options
1. **Tantivy** — Rust-native, embeddable, BM25 ranking, faceted search
2. **Meilisearch** — Separate process, REST API, typo-tolerant, easier setup
3. **SQLite FTS5** — Built into rusqlite, simple but limited ranking

## Decision
**Tantivy** — Embeds directly in the Tauri process, no extra service needed.

## Consequences
- Index stored at `.cortex/search-index/` in the vault
- Incremental updates on file changes
- Snippet generation built-in
- More complex API than Meilisearch

#decision #search #rust
