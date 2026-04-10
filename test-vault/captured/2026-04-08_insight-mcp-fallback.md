---
type: captured-context
source: claude-code
tags: [insight, mcp, error-handling]
created: 2026-04-08T13:45:00Z
---

# MCP Search Should Fall Back to Grep

When the Tantivy search index isn't built yet (vault just opened, or index corrupted), the `cortex/search` MCP tool should fall back to simple text grep through vault files.

This ensures Claude Code always gets a response, even if degraded. The search results just won't be ranked.

Related: [[MCP Integration Guide]], [[Decision - Tantivy vs Meilisearch]]
