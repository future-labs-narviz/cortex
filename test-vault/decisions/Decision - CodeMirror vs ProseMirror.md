---
title: "Decision: CodeMirror vs ProseMirror"
tags: [decision, editor, frontend]
created: 2026-04-02
type: decision
status: decided
---

# Decision: CodeMirror vs ProseMirror

## Context
Need a markdown editor for [[Cortex App]]. Key requirement: raw markdown editing with live decorations.

## Options
1. **CodeMirror 6** — Same engine Obsidian uses. Excellent for plain text with decorations.
2. **ProseMirror** — Schema-based, better for WYSIWYG. Used by Notion, Atlassian.
3. **TipTap** — ProseMirror wrapper, easier API but less control.
4. **Monaco** — VS Code engine, overkill for notes.

## Decision
**CodeMirror 6** — Obsidian proved it works for markdown knowledge apps. Extension system is powerful for [[Knowledge Graph|wikilinks]], [[Tantivy|search]], and custom decorations.

## Consequences
- Excellent performance (handles 10K+ line files)
- Extension API is complex but well-documented
- Heading hierarchy done via CSS classes (`.cm-header-1` etc.)

#decision #editor
