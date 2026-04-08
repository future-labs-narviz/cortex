import { useEffect, useRef, useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown/renderer";
import { useVaultStore } from "@/stores/vaultStore";
import { findNoteByName } from "@/lib/utils/noteResolver";
import mermaid from "mermaid";

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
}

export function MarkdownPreview({ content, filePath }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(content), [content]);

  // Handle wikilink clicks
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(".preview-wikilink");
      if (target) {
        e.preventDefault();
        const noteName = target.dataset.target;
        if (noteName) {
          const files = useVaultStore.getState().files;
          const match = findNoteByName(files, noteName);
          if (match) {
            useVaultStore.getState().setActiveFile(match.path);
          }
        }
      }
    };

    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, []);

  // Render mermaid diagrams after HTML updates
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mermaidDivs = el.querySelectorAll<HTMLElement>(".preview-mermaid");
    if (mermaidDivs.length === 0) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });

    mermaidDivs.forEach(async (div, i) => {
      const source = div.dataset.source;
      if (!source) return;
      try {
        const id = `mermaid-preview-${i}-${Date.now()}`;
        const { svg } = await mermaid.render(id, source);
        div.innerHTML = svg;
      } catch {
        div.innerHTML = `<pre style="color:var(--red);font-size:12px;padding:12px">Mermaid diagram error</pre>`;
      }
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="preview-content flex-1 min-h-0 overflow-y-auto"
      style={{
        padding: "24px 32px",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-family)",
        fontSize: "var(--font-size)",
        lineHeight: 1.8,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
