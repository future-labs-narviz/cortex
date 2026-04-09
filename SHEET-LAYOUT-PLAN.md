# Cortex Sheet Layout Engine — Architecture Plan

## Vision

Replace the current rigid sidebar + editor layout with a **flexible sheet-based system** inspired by Obsidian's workspace panes, Notion's block composability, and Figma's clean aesthetic. Every piece of content — files, graph, backlinks, tags, timeline — lives in a "sheet" that can be arranged freely.

## Research Summary

### How Obsidian Does It

Obsidian's workspace is a **recursive tree of splits and leaves**:

```
Workspace
├── Left Sidebar (collapsible)
│   └── Tab Group (file explorer, search, bookmarks...)
├── Root Split (the main area)
│   ├── Tab Group A
│   │   ├── Leaf: note.md (editing)
│   │   └── Leaf: other.md (reading)
│   └── Tab Group B (horizontal/vertical split)
│       └── Leaf: graph view
└── Right Sidebar (collapsible)
    └── Tab Group (backlinks, outline, tags...)
```

Key concepts:
- **Leaf**: A single content view (a note, a graph, a panel)
- **Tab Group**: Multiple leaves stacked as tabs — only one visible at a time
- **Split**: A container that divides space between children (horizontal or vertical)
- **Three view modes per note**: Source (raw markdown), Live Preview (WYSIWYG-ish), Reading (rendered HTML)
- Workspace state saved as JSON, restorable

### How Notion Does It

- Everything is a **block** — pages are blocks whose children are content blocks
- Layout is a vertical stack with flexible padding between adjacent blocks
- Pages open as full views or side peeks
- Clean, minimal chrome — content is king

### What Cortex Should Be

A hybrid: Obsidian's flexible pane splitting + Notion's clean sheet aesthetic + Figma's design quality.

---

## Architecture: The Sheet System

### Core Concepts

```
┌─ Screen ──────────────────────────────────────────────┐
│                                                        │
│  ┌─ Sheet ──────────┐  ┌─ Sheet ──────────────────┐   │
│  │                   │  │                           │   │
│  │  [Tab: Graph]     │  │  [Tab: Welcome.md]        │   │
│  │                   │  │  [Edit] [Split] [Preview]  │   │
│  │  ┌─────────────┐  │  │                           │   │
│  │  │ Knowledge   │  │  │  # Welcome to Cortex      │   │
│  │  │ Graph       │  │  │                           │   │
│  │  │ (rendered)  │  │  │  Your personal knowledge  │   │
│  │  └─────────────┘  │  │  management system...     │   │
│  │                   │  │                           │   │
│  └───────────────────┘  └───────────────────────────┘   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Sheet

A **sheet** is the fundamental layout unit. It's a rounded, elevated card that can display any content type:

- **File sheets**: Edit/Split/Preview modes for markdown files
- **Graph sheets**: Knowledge graph visualization
- **Panel sheets**: Tags, backlinks, search, calendar, timeline, etc.
- **Empty sheets**: Landing state showing quick-access buttons to open content

Visual design:
- Rounded corners (12-16px radius)
- Subtle elevated shadow
- Clean header bar with tabs and view mode buttons
- Notion/Figma aesthetic — minimal chrome, content-forward
- Background: `var(--bg-primary)` with `var(--border)` outline

### Layout Tree (Recursive)

```typescript
type LayoutNode =
  | { type: "sheet"; id: string; content: SheetContent }
  | { type: "split"; direction: "horizontal" | "vertical"; children: LayoutNode[]; ratios: number[] };

type SheetContent =
  | { kind: "file"; filePath: string; viewMode: "edit" | "split" | "preview" }
  | { kind: "graph"; center?: string; depth: number }
  | { kind: "panel"; panel: "tags" | "backlinks" | "search" | "calendar" | "timeline" | "voice" | "integrations" }
  | { kind: "empty" };
```

### Constraints
- Maximum **3 sheets** visible at once (prevents overwhelming complexity)
- Splits can be horizontal (side by side) or vertical (top/bottom)
- Each sheet has its own tab bar (for multiple files or views)
- Minimum sheet width: 300px, minimum height: 200px

### Empty Sheet

When a sheet has no content, it shows a beautiful landing state:

```
┌──────────────────────────────────┐
│                                  │
│        ┌────────────────┐        │
│        │  Cortex Logo   │        │
│        └────────────────┘        │
│                                  │
│    Quick Access:                 │
│                                  │
│    [📝 New Note]  [🔍 Search]   │
│    [🕸 Graph]    [📅 Calendar]  │
│    [🔗 Backlinks] [🏷 Tags]    │
│                                  │
│    Recent Files:                 │
│    ├ Welcome.md                  │
│    ├ Project Notes.md            │
│    └ Daily/2026-04-08.md         │
│                                  │
└──────────────────────────────────┘
```

---

## Markdown View Modes

Each file sheet has 3 view modes, controlled by a segmented button group:

### Edit Mode
- Raw CodeMirror editor (current behavior)
- Full markdown source with syntax highlighting
- All extensions active (callouts, code blocks, math, mermaid render inline)

### Preview Mode  
- Fully rendered HTML output
- Markdown → HTML via a renderer (e.g., `marked` or `remark`)
- Styled with the same design tokens
- Read-only, no cursor
- Images, math, mermaid all fully rendered
- Smooth scroll, clickable links

### Split Mode
- Editor on left, preview on right (side by side)
- Synchronized scrolling (scroll position linked)
- Editor changes → preview updates in real-time
- Resizable divider between them

### View Mode Button Design

```
┌─────────────────────────┐
│  [Edit] [Split] [Read]  │   ← Segmented control
└─────────────────────────┘
```

- Pill-shaped segmented control (like iOS)
- Active segment: `var(--accent-soft)` bg, `var(--accent)` text
- Inactive: transparent, `var(--text-muted)`
- Smooth 200ms slide transition for the active indicator
- Height: 28px, border-radius: 14px (fully rounded)
- Located in the sheet header, right side

---

## Implementation Plan

### Phase 1: Layout Engine (Core Architecture)

**New files:**
- `src/stores/layoutStore.ts` — Layout tree state (Zustand)
- `src/components/layout/Sheet.tsx` — Single sheet container
- `src/components/layout/SheetHeader.tsx` — Sheet title bar with tabs + controls
- `src/components/layout/LayoutSplit.tsx` — Recursive split renderer
- `src/components/layout/LayoutRoot.tsx` — Top-level layout manager (replaces current SplitView usage)
- `src/components/layout/EmptySheet.tsx` — Empty sheet landing state
- `src/components/layout/SheetDivider.tsx` — Resizable divider between sheets

**Layout store shape:**
```typescript
interface LayoutStore {
  root: LayoutNode;
  
  // Actions
  openInSheet: (sheetId: string, content: SheetContent) => void;
  splitSheet: (sheetId: string, direction: "horizontal" | "vertical", newContent: SheetContent) => void;
  closeSheet: (sheetId: string) => void;
  setViewMode: (sheetId: string, mode: "edit" | "split" | "preview") => void;
  setSplitRatio: (splitId: string, ratios: number[]) => void;
  
  // Serialization
  saveLayout: () => void;
  restoreLayout: () => void;
}
```

### Phase 2: Markdown Preview Renderer

**New files:**
- `src/components/editor/MarkdownPreview.tsx` — Rendered HTML preview component
- `src/lib/markdown/renderer.ts` — Markdown → HTML pipeline

**Renderer pipeline:**
1. Parse markdown with `remark` (or `unified` + `remark-parse`)
2. Apply transformations: wikilinks → links, tags → styled spans, math → KaTeX, mermaid → SVG
3. Output sanitized HTML
4. Render in a styled scrollable container
5. Support click-to-navigate on wikilinks

**Scroll sync (Split mode):**
- Map editor line positions to preview DOM positions
- On editor scroll → calculate corresponding preview scroll position
- Debounce to 16ms (60fps)

### Phase 3: Sheet Visual Design

**Sheet container design:**
```css
.sheet {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
}
.sheet-header {
  height: 44px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 12px 12px 0 0;
}
```

**View mode segmented control:**
- 3 buttons in a pill container
- Sliding active indicator (animated div behind active button)
- Icons: Pencil (Edit), Columns (Split), Eye (Preview)

### Phase 4: Migrate Existing Layout

- Replace `AppShell.tsx` layout with `LayoutRoot`
- Move sidebar icon rail to remain as-is (navigation)
- Clicking a sidebar icon opens that panel IN a sheet (not in sidebar panel area)
- Or: sidebar remains for navigation, sheets are the main content area
- Preserve all keyboard shortcuts

### Phase 5: Layout Persistence

- Save layout tree to localStorage
- Restore on app load
- Workspace presets: "Writing" (single sheet), "Research" (file + graph + backlinks), "Review" (file + preview)

---

## Design Tokens for Sheets

```css
--sheet-radius: 12px;
--sheet-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
--sheet-border: 1px solid var(--border);
--sheet-header-height: 44px;
--sheet-gap: 8px;  /* gap between sheets */
```

---

## Key Decisions Needed

1. **Sidebar role**: Does the icon rail stay as a navigation launcher, or do panels move entirely into sheets?
2. **Sheet limit**: Hard cap at 3, or soft limit with degraded UX beyond 3?
3. **Tab behavior**: Can a sheet have multiple tabs (like Obsidian), or is it one content per sheet?
4. **Mobile/small screen**: How does the layout degrade on narrow windows?
5. **Markdown renderer**: `marked` (fast, simple) vs `remark/unified` (extensible, plugin ecosystem)?

---

## Files That Will Change

| File | Change |
|------|--------|
| `src/components/layout/AppShell.tsx` | Replace main content area with LayoutRoot |
| `src/components/editor/SplitView.tsx` | Remove — replaced by LayoutSplit + Sheet |
| `src/stores/editorStore.ts` | Adapt tab management to work per-sheet |
| `src/components/layout/Sidebar.tsx` | Simplify — becomes pure navigation rail |
| `src/components/editor/TabBar.tsx` | Move into SheetHeader |
| NEW: `src/stores/layoutStore.ts` | Layout tree state |
| NEW: `src/components/layout/Sheet.tsx` | Sheet container |
| NEW: `src/components/layout/LayoutRoot.tsx` | Root layout renderer |
| NEW: `src/components/layout/LayoutSplit.tsx` | Recursive split |
| NEW: `src/components/layout/EmptySheet.tsx` | Empty sheet state |
| NEW: `src/components/editor/MarkdownPreview.tsx` | Preview renderer |
| NEW: `src/lib/markdown/renderer.ts` | MD → HTML pipeline |

---

## Stack Additions

- `remark` + `remark-html` + `remark-gfm` — markdown rendering
- `remark-math` + `rehype-katex` — math in preview
- `mermaid` (already installed) — diagrams in preview

## References

- [Obsidian Workspace Architecture](https://help.obsidian.md/tabs)
- [Obsidian View Modes](https://help.obsidian.md/edit-and-read)
- [Notion Block Architecture](https://www.notion.com/blog/data-model-behind-notion)
- [Obsidian Pane Layout](https://demo-obsidian.owenyoung.com/Panes/Pane%20layout/)
- [Notion Page Design Updates](https://www.notion.com/blog/updating-the-design-of-notion-pages)
