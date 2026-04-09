import { useState, useCallback, useEffect, useMemo } from "react";
import { Tags, FileText, Search, ChevronDown, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import type { NoteData } from "@/lib/types";

// Consistent color palette for tag dots — hash tag name to pick a color
const TAG_COLORS = [
  "var(--accent)",
  "var(--green)",
  "var(--purple)",
  "var(--orange)",
  "var(--cyan)",
  "var(--yellow)",
  "var(--red)",
];

function hashTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function TagsPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);

  const openNote = useCallback((path: string) => {
    setActiveFile(path);
    const layout = useLayoutStore.getState();
    const sheetId = layout.activeSheetId;
    invoke<NoteData>("read_note", { path })
      .then((data) => layout.openFile(sheetId, path, data.content))
      .catch(() => layout.openFile(sheetId, path, ""));
  }, [setActiveFile]);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [tagNotes, setTagNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isVaultOpen) return;
    invoke<{ name: string; count: number }[]>("get_all_tags")
      .then(setTags)
      .catch(() => setTags([]));
  }, [isVaultOpen]);

  const filteredTags = useMemo(() => {
    if (!filter.trim()) return tags;
    const lower = filter.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(lower));
  }, [tags, filter]);

  const handleTagClick = useCallback(
    async (tagName: string) => {
      if (expandedTag === tagName) {
        setExpandedTag(null);
        setTagNotes([]);
        return;
      }
      setExpandedTag(tagName);
      setLoading(true);
      try {
        const notes = await invoke<string[]>("get_notes_by_tag", {
          tag: tagName,
        });
        setTagNotes(notes);
      } catch {
        setTagNotes([]);
      }
      setLoading(false);
    },
    [expandedTag],
  );

  if (!isVaultOpen) {
    return <EmptyTagsState message="Open a vault to browse tags." />;
  }

  if (tags.length === 0) {
    return <EmptyTagsState message="No tags found in your vault yet." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Search filter */}
      <div style={{ position: "relative" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tags..."
          aria-label="Filter tags"
          style={{
            width: "100%",
            height: 32,
            paddingLeft: 32,
            paddingRight: 10,
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--muted)",
            color: "var(--text-primary)",
            outline: "none",
            transition: "border-color 150ms",
          }}
        />
      </div>

      {/* Tag count summary */}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""}
        {filter && ` matching "${filter}"`}
      </div>

      {/* Tag list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filteredTags.map((tag) => (
          <TagItem
            key={tag.name}
            tag={tag}
            isExpanded={expandedTag === tag.name}
            tagNotes={expandedTag === tag.name ? tagNotes : []}
            loading={expandedTag === tag.name && loading}
            onClick={() => handleTagClick(tag.name)}
            onNoteClick={openNote}
          />
        ))}
      </div>
    </div>
  );
}

function TagItem({
  tag,
  isExpanded,
  tagNotes,
  loading,
  onClick,
  onNoteClick,
}: {
  tag: { name: string; count: number };
  isExpanded: boolean;
  tagNotes: string[];
  loading: boolean;
  onClick: () => void;
  onNoteClick: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = hashTagColor(tag.name);

  return (
    <div>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "7px 8px",
          borderRadius: 6,
          border: "none",
          background: isExpanded
            ? "var(--accent-soft)"
            : hovered
              ? "var(--muted-hover)"
              : "transparent",
          color: isExpanded ? "var(--accent)" : "var(--text-secondary)",
          cursor: "pointer",
          fontSize: 13,
          transition: "all 150ms",
          textAlign: "left",
        }}
      >
        {/* Chevron */}
        {isExpanded ? (
          <ChevronDown size={12} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
        ) : (
          <ChevronRight size={12} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
        )}

        {/* Color dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            opacity: 0.8,
          }}
        />

        {/* Tag name */}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          #{tag.name}
        </span>

        {/* Count badge */}
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
            background: isExpanded ? "rgba(59,130,246,0.15)" : "var(--muted)",
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {tag.count}
        </span>
      </button>

      {/* Expanded notes list */}
      {isExpanded && (
        <div
          style={{
            paddingLeft: 20,
            paddingTop: 4,
            paddingBottom: 4,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {loading ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 8px" }}>
              Loading...
            </span>
          ) : (
            tagNotes.map((notePath) => (
              <NoteItem
                key={notePath}
                path={notePath}
                onClick={() => onNoteClick(notePath)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({
  path,
  onClick,
}: {
  path: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
  const folder = path.includes("/") ? path.replace(/\/[^/]+$/, "") : "";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "5px 8px",
        borderRadius: 5,
        border: "none",
        background: hovered ? "var(--muted-hover)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 150ms",
      }}
    >
      <FileText
        size={12}
        style={{
          flexShrink: 0,
          color: hovered ? "var(--accent)" : "var(--text-muted)",
          transition: "color 150ms",
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            color: hovered ? "var(--accent)" : "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transition: "color 150ms",
          }}
        >
          {name}
        </div>
        {folder && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: '"JetBrains Mono", monospace',
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {folder}
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyTagsState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 200,
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-xl)",
          background: "var(--muted)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Tags style={{ width: 20, height: 20, color: "var(--text-muted)" }} />
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {message}
      </p>
    </div>
  );
}
