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

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  shortcut?: string;
}

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

const ICON_SIZE = 15;

export function EditorToolbar() {
  const actions: ToolbarAction[] = [
    {
      icon: <Bold size={ICON_SIZE} />,
      label: "Bold",
      shortcut: "Ctrl+B",
      action: () => wrapSelection("**", "**"),
    },
    {
      icon: <Italic size={ICON_SIZE} />,
      label: "Italic",
      shortcut: "Ctrl+I",
      action: () => wrapSelection("*", "*"),
    },
    {
      icon: <Strikethrough size={ICON_SIZE} />,
      label: "Strikethrough",
      action: () => wrapSelection("~~", "~~"),
    },
    { type: "separator" } as unknown as ToolbarAction,
    {
      icon: <Heading1 size={ICON_SIZE} />,
      label: "Heading 1",
      action: () => prefixLine("# "),
    },
    {
      icon: <Heading2 size={ICON_SIZE} />,
      label: "Heading 2",
      action: () => prefixLine("## "),
    },
    {
      icon: <Heading3 size={ICON_SIZE} />,
      label: "Heading 3",
      action: () => prefixLine("### "),
    },
    { type: "separator" } as unknown as ToolbarAction,
    {
      icon: <Link size={ICON_SIZE} />,
      label: "Link",
      action: () => {
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
      },
    },
    {
      icon: <Image size={ICON_SIZE} />,
      label: "Image",
      action: () => insertBlock("![alt](image-url)"),
    },
    {
      icon: <Code size={ICON_SIZE} />,
      label: "Code block",
      action: () => {
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
      },
    },
    { type: "separator" } as unknown as ToolbarAction,
    {
      icon: <List size={ICON_SIZE} />,
      label: "Bullet list",
      action: () => prefixLine("- "),
    },
    {
      icon: <ListOrdered size={ICON_SIZE} />,
      label: "Numbered list",
      action: () => prefixLine("1. "),
    },
    {
      icon: <CheckSquare size={ICON_SIZE} />,
      label: "Checkbox",
      action: () => prefixLine("- [ ] "),
    },
    {
      icon: <Quote size={ICON_SIZE} />,
      label: "Quote",
      action: () => prefixLine("> "),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 h-9 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
      {actions.map((action, i) => {
        if ((action as unknown as { type: string }).type === "separator") {
          return (
            <div
              key={`sep-${i}`}
              className="w-px h-4 mx-1 bg-[var(--border)]"
            />
          );
        }
        return (
          <button
            key={action.label}
            onClick={action.action}
            title={
              action.shortcut
                ? `${action.label} (${action.shortcut})`
                : action.label
            }
            className="flex items-center justify-center w-7 h-7 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            {action.icon}
          </button>
        );
      })}
      {/* Voice record button */}
      <div className="w-px h-4 mx-1 bg-[var(--border)]" />
      <VoiceRecordButton
        position="toolbar"
        onTranscriptionComplete={(text) => {
          editorApi.insertAtCursor(text);
        }}
      />
    </div>
  );
}
