import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Plus } from "lucide-react";
import type { TemplateInfo } from "@/lib/types";

export function TemplateSettings() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const result = await invoke<TemplateInfo[]>("list_templates");
      setTemplates(result);
    } catch (err) {
      console.warn("[Cortex] list_templates failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateTemplate = async () => {
    const name = window.prompt("Template name:");
    if (!name) return;

    try {
      // Create a basic template file via write_note into .cortex/templates/
      const content = `---\ntitle: {{title}}\ncreated: {{datetime}}\ntags: []\n---\n\n# {{title}}\n\n`;
      await invoke("write_note", {
        path: `.cortex/templates/${name}.md`,
        content,
      });
      await fetchTemplates();
    } catch (err) {
      console.warn("[Cortex] Failed to create template:", err);
    }
  };

  const selected = templates.find((t) => t.name === selectedTemplate);

  if (loading) {
    return (
      <div className="text-xs text-[var(--text-muted)] p-4">
        Loading templates...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Templates
        </h3>
        <button
          onClick={handleCreateTemplate}
          className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline cursor-pointer"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No templates found.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {templates.map((tmpl) => (
            <button
              key={tmpl.name}
              onClick={() =>
                setSelectedTemplate(
                  selectedTemplate === tmpl.name ? null : tmpl.name,
                )
              }
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-xs cursor-pointer ${
                selectedTemplate === tmpl.name
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              }`}
            >
              <FileText size={14} />
              {tmpl.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-2 p-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)]">
          <p className="text-[10px] font-medium text-[var(--text-muted)] mb-1">
            Preview
          </p>
          <pre className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap break-words font-mono leading-relaxed">
            {selected.preview}
          </pre>
        </div>
      )}
    </div>
  );
}
