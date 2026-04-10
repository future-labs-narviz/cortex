---
type: captured-context
source: claude-code
tags: [insight, safari, bug, css]
created: 2026-04-08T20:00:00Z
---

# Safari 15 Blank Page Bug

First UI polish pass caused a completely blank page in Tauri WKWebView. Root cause: Tailwind v4 outputs `oklch()` colors which Safari 15 doesn't support.

Fix: Use hex colors in CSS variables, inline `style={{}}` for critical spacing.

This cost 3 hours of debugging. Documenting as [[Pattern - Safari 15 Compatibility]] so it never happens again.
