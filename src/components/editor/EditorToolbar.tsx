import { useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
} from "lucide-react";
import { getEditorView } from "@/lib/editorApi";
import { editorApi } from "@/lib/editorApi";
import { VoiceRecordButton } from "@/components/voice/VoiceRecordButton";

function wrapSelection(before: string, after: string) {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const replacement = `${before}${selected || "text"}${after}`;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: {
      anchor: from + before.length,
      head: from + replacement.length - after.length,
    },
  });
  view.focus();
}

function prefixLine(prefix: string) {
  const view = getEditorView();
  if (!view) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

function insertBlock(text: string) {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

const ICON = 16;

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: () => void;
}

function ToolbarButton({ icon, label, shortcut, action }: ToolbarButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={action}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        transition: 'all 150ms',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: hovered ? 'var(--muted-hover)' : 'transparent',
      }}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'var(--border)',
        marginLeft: 4,
        marginRight: 4,
        flexShrink: 0,
      }}
    />
  );
}

export function EditorToolbar() {
  const handleLink = useCallback(() => {
    const view = getEditorView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const text = selected || "link text";
    const replacement = `[${text}](url)`;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: {
        anchor: from + text.length + 3,
        head: from + text.length + 6,
      },
    });
    view.focus();
  }, []);

  const handleCodeBlock = useCallback(() => {
    const view = getEditorView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const replacement = `\`\`\`\n${selected || "code"}\n\`\`\``;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: {
        anchor: from + 4,
        head: from + 4 + (selected.length || 4),
      },
    });
    view.focus();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        paddingLeft: 12,
        paddingRight: 12,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        gap: 2,
      }}
    >
      {/* Text formatting group */}
      <ToolbarButton icon={<Bold size={ICON} />} label="Bold" shortcut="Cmd+B" action={() => wrapSelection("**", "**")} />
      <ToolbarButton icon={<Italic size={ICON} />} label="Italic" shortcut="Cmd+I" action={() => wrapSelection("*", "*")} />
      <ToolbarButton icon={<Strikethrough size={ICON} />} label="Strikethrough" action={() => wrapSelection("~~", "~~")} />

      <Separator />

      {/* Headings group */}
      <ToolbarButton icon={<Heading1 size={ICON} />} label="Heading 1" action={() => prefixLine("# ")} />
      <ToolbarButton icon={<Heading2 size={ICON} />} label="Heading 2" action={() => prefixLine("## ")} />
      <ToolbarButton icon={<Heading3 size={ICON} />} label="Heading 3" action={() => prefixLine("### ")} />

      <Separator />

      {/* Insert group */}
      <ToolbarButton icon={<Link size={ICON} />} label="Link" action={handleLink} />
      <ToolbarButton icon={<Image size={ICON} />} label="Image" action={() => insertBlock("![alt](image-url)")} />
      <ToolbarButton icon={<Code size={ICON} />} label="Code block" action={handleCodeBlock} />

      <Separator />

      {/* Lists group */}
      <ToolbarButton icon={<List size={ICON} />} label="Bullet list" action={() => prefixLine("- ")} />
      <ToolbarButton icon={<ListOrdered size={ICON} />} label="Numbered list" action={() => prefixLine("1. ")} />
      <ToolbarButton icon={<CheckSquare size={ICON} />} label="Checkbox" action={() => prefixLine("- [ ] ")} />

      <Separator />

      {/* Block quote */}
      <ToolbarButton icon={<Quote size={ICON} />} label="Quote" action={() => prefixLine("> ")} />

      <Separator />

      {/* Voice */}
      <VoiceRecordButton
        position="toolbar"
        onTranscriptionComplete={(text) => {
          editorApi.insertAtCursor(text);
        }}
      />
    </div>
  );
}
