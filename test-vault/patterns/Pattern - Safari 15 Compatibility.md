---
title: "Pattern: Safari 15 Compatibility"
tags: [pattern, tauri, safari, css]
created: 2026-04-08
type: pattern
---

# Pattern: Safari 15 Compatibility

## Problem
Tauri on macOS 12 uses Safari 15's WKWebView. Modern CSS features break silently.

## What Breaks
| Feature | Status |
|---------|--------|
| `oklch()` colors | NOT supported |
| `color-mix()` | NOT supported |
| Tailwind v4 color classes | Output oklch internally |
| Regex lookbehind `(?<=...)` | NOT supported |

## Solution
Use inline `style={{}}` for all critical spacing. CSS variables with hex values only.

```tsx
// BAD — breaks in Safari 15
className="px-5 mb-4"

// GOOD — works everywhere
style={{ paddingLeft: 20, marginBottom: 16 }}
```

## Discovered During
UI refinement of [[Cortex App]]. First polish pass caused blank pages until we identified the issue.

#pattern #tauri #safari #css
