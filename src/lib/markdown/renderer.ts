import { marked, type TokensList, type Token } from "marked";
import katex from "katex";

// ── Configure marked ─────────────────────────────────────

marked.setOptions({
  gfm: true,
  breaks: false,
});

// ── Custom extensions ────────────────────────────────────

// Wikilinks: [[target]] or [[target|display]]
const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Tags: #tag-name (not inside URLs or code)
const tagRegex = /(?:^|[\s(])#([a-zA-Z0-9_\/-]+)/g;

// Block math: $$ ... $$
const blockMathRegex = /^\$\$([\s\S]*?)\$\$/gm;

// Inline math: $...$
const inlineMathRegex = /\$([^\$\n]+?)\$/g;

// Callouts: > [!TYPE] optional title
const calloutRegex = /^<blockquote>\n<p>\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\](.*?)<\/p>([\s\S]*?)<\/blockquote>/gm;

// Mermaid code blocks
const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

// Frontmatter: --- ... --- at the start
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;

// ── Callout config ───────────────────────────────────────

const CALLOUT_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  NOTE: { bg: "rgba(59, 130, 246, 0.08)", border: "#3b82f6", icon: "info" },
  WARNING: { bg: "rgba(245, 158, 11, 0.08)", border: "#f59e0b", icon: "alert-triangle" },
  TIP: { bg: "rgba(16, 185, 129, 0.08)", border: "#10b981", icon: "lightbulb" },
  IMPORTANT: { bg: "rgba(139, 92, 246, 0.08)", border: "#8b5cf6", icon: "alert-circle" },
  CAUTION: { bg: "rgba(239, 68, 68, 0.08)", border: "#ef4444", icon: "shield-alert" },
};

// ── Render pipeline ──────────────────────────────────────

export function renderMarkdown(source: string): string {
  let text = source;

  // 1. Strip frontmatter
  text = text.replace(frontmatterRegex, "");

  // 2. Process block math before marked (so it doesn't get mangled)
  const blockMathMap = new Map<string, string>();
  let mathIndex = 0;
  text = text.replace(blockMathRegex, (_match, content) => {
    const key = `%%BLOCKMATH_${mathIndex++}%%`;
    try {
      blockMathMap.set(key, katex.renderToString(content.trim(), { displayMode: true, throwOnError: false }));
    } catch {
      blockMathMap.set(key, `<pre class="math-error">${escapeHtml(content)}</pre>`);
    }
    return key;
  });

  // 3. Process inline math
  const inlineMathMap = new Map<string, string>();
  let inlineMathIndex = 0;
  text = text.replace(inlineMathRegex, (_match, content) => {
    const key = `%%INLINEMATH_${inlineMathIndex++}%%`;
    try {
      inlineMathMap.set(key, katex.renderToString(content.trim(), { displayMode: false, throwOnError: false }));
    } catch {
      inlineMathMap.set(key, `<code class="math-error">${escapeHtml(content)}</code>`);
    }
    return key;
  });

  // 4. Run marked
  let html = marked.parse(text, { async: false }) as string;

  // 5. Restore block math
  for (const [key, rendered] of blockMathMap) {
    html = html.replace(key, `<div class="preview-math-block">${rendered}</div>`);
  }

  // 6. Restore inline math
  for (const [key, rendered] of inlineMathMap) {
    html = html.replace(key, `<span class="preview-math-inline">${rendered}</span>`);
  }

  // 7. Wikilinks
  html = html.replace(wikilinkRegex, (_match, target, display) => {
    const label = display || target;
    return `<a class="preview-wikilink" data-target="${escapeAttr(target)}">${escapeHtml(label)}</a>`;
  });

  // 8. Tags
  html = html.replace(tagRegex, (match, tag) => {
    const prefix = match.startsWith("#") ? "" : match[0];
    return `${prefix}<span class="preview-tag">#${escapeHtml(tag)}</span>`;
  });

  // 9. Callouts
  html = html.replace(calloutRegex, (_match, type, title, body) => {
    const config = CALLOUT_COLORS[type.toUpperCase()] ?? CALLOUT_COLORS.NOTE;
    const displayTitle = title.trim() || type.charAt(0) + type.slice(1).toLowerCase();
    return `<div class="preview-callout" style="background:${config.bg};border-left:3px solid ${config.border};border-radius:8px;padding:12px 16px;margin:12px 0">
      <div style="font-weight:600;font-size:13px;color:${config.border};margin-bottom:4px">${escapeHtml(displayTitle)}</div>
      <div style="font-size:13px;color:var(--text-secondary)">${body.trim()}</div>
    </div>`;
  });

  // 10. Mermaid — leave as placeholder div (rendered client-side)
  html = html.replace(mermaidRegex, (_match, content) => {
    return `<div class="preview-mermaid" data-source="${escapeAttr(content.trim())}"><div class="preview-mermaid-loading" style="padding:16px;color:var(--text-muted);font-size:12px">Loading diagram...</div></div>`;
  });

  return html;
}

// ── Utilities ────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
