import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, GripHorizontal } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import type { LayoutNode as LayoutNodeType } from "@/lib/types/layout";
import { LayoutNode } from "./LayoutNode";

const MIN_PANE_PX = 200;

interface LayoutSplitProps {
  node: Extract<LayoutNodeType, { type: "split" }>;
}

export function LayoutSplit({ node }: LayoutSplitProps) {
  const setSplitRatio = useLayoutStore((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isHorizontal = node.direction === "horizontal";

  // Find the first sheet ID in the left child (used as anchor for ratio updates)
  const anchorSheetId = getFirstSheetId(node.children[0]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container || !anchorSheetId) return;

      const rect = container.getBoundingClientRect();
      let ratio: number;

      if (isHorizontal) {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }

      const containerSize = isHorizontal ? rect.width : rect.height;
      const minRatio = MIN_PANE_PX / containerSize;
      const maxRatio = 1 - minRatio;
      ratio = Math.max(minRatio, Math.min(maxRatio, ratio));

      setSplitRatio(anchorSheetId, ratio);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isHorizontal, setSplitRatio, anchorSheetId]);

  const handleDoubleClick = useCallback(() => {
    if (anchorSheetId) setSplitRatio(anchorSheetId, 0.5);
  }, [setSplitRatio, anchorSheetId]);

  const pct1 = `${node.ratio * 100}%`;
  const pct2 = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`flex flex-1 min-h-0 min-w-0 ${isHorizontal ? "flex-row" : "flex-col"}`}
      style={{ gap: "var(--sheet-gap, 8px)" }}
    >
      {/* Child 1 */}
      <div
        style={
          isHorizontal
            ? { width: pct1, minWidth: MIN_PANE_PX }
            : { height: pct1, minHeight: MIN_PANE_PX }
        }
        className="flex min-w-0 min-h-0"
      >
        <LayoutNode node={node.children[0]} />
      </div>

      {/* Divider */}
      <div
        className={`group flex-shrink-0 relative ${
          isHorizontal
            ? "w-[4px] cursor-col-resize"
            : "h-[4px] cursor-row-resize"
        }`}
        style={{ margin: isHorizontal ? "0 -2px" : "-2px 0", zIndex: 1 }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={`absolute transition-all duration-150 ease-out ${
            isDragging
              ? "bg-[var(--accent)]"
              : "bg-[var(--border)] group-hover:bg-[var(--accent)]/70"
          } ${
            isHorizontal
              ? `h-full left-1/2 -translate-x-1/2 top-0 ${isDragging ? "w-[3px]" : "w-[1px] group-hover:w-[3px]"}`
              : `w-full top-1/2 -translate-y-1/2 left-0 ${isDragging ? "h-[3px]" : "h-[1px] group-hover:h-[3px]"}`
          }`}
        />
        <div
          className="absolute opacity-0 group-hover:opacity-60 transition-opacity duration-150"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        >
          {isHorizontal ? (
            <GripVertical size={12} />
          ) : (
            <GripHorizontal size={12} />
          )}
        </div>
      </div>

      {/* Child 2 */}
      <div
        style={
          isHorizontal
            ? { width: pct2, minWidth: MIN_PANE_PX }
            : { height: pct2, minHeight: MIN_PANE_PX }
        }
        className="flex min-w-0 min-h-0"
      >
        <LayoutNode node={node.children[1]} />
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50"
          style={{ cursor: isHorizontal ? "col-resize" : "row-resize" }}
        />
      )}
    </div>
  );
}

/** Walk the tree to find the first leaf sheet ID */
function getFirstSheetId(node: LayoutNodeType): string | null {
  if (node.type === "sheet") return node.sheetId;
  return getFirstSheetId(node.children[0]);
}
