---
name: cortex
description: Search, capture, and query your Cortex knowledge graph during development sessions. Use when you need context from past work, want to capture insights, or need to find related notes.
aliases: [cx, knowledge, notes]
whenToUse: When the user asks about past decisions, needs context from their knowledge base, wants to capture an insight or decision, or references their notes/vault.
userInvocable: true
argumentHint: "<search|capture|why|related|gaps> [query]"
---

# Cortex Knowledge Integration

You have access to the user's Cortex knowledge graph via MCP tools. Use these tools to help the user leverage their accumulated knowledge during development.

## Available Actions

### Search: `/cortex search <query>`
Search the knowledge graph for relevant notes, voice transcriptions, and captured sessions.
Use the `cortex/search` MCP tool.

### Capture: `/cortex capture`
Capture the current context, insight, or decision to the knowledge graph.
Ask the user what they'd like to capture, then use the `cortex/capture` MCP tool with appropriate tags.

### Why: `/cortex why <topic>`
Explain why something was built a certain way by searching for decision records and session captures.
Use `cortex/search` with the topic, then `cortex/get-context` for deeper context.

### Related: `/cortex related <file-or-topic>`
Find notes related to a specific file or topic.
Use the `cortex/list-related` MCP tool.

### Gaps: `/cortex gaps`
Identify knowledge gaps - topics that have been worked on but not documented.
Use `cortex/list-tags` to see what's documented, compare with recent git activity.

## Behavior Guidelines

1. When the user starts a new feature, proactively check if Cortex has relevant context using `cortex/get-context`
2. After completing a significant task, suggest capturing the key decisions and what worked/failed
3. When debugging, search for similar past issues in the knowledge graph
4. Format captured insights with clear tags for easy retrieval later
5. Always cite the source note path when referencing knowledge from Cortex
