import type { LayoutNode as LayoutNodeType } from "@/lib/types/layout";
import { Sheet } from "./Sheet";
import { LayoutSplit } from "./LayoutSplit";

export function LayoutNode({ node }: { node: LayoutNodeType }) {
  if (node.type === "sheet") {
    return <Sheet sheetId={node.sheetId} />;
  }
  return <LayoutSplit node={node} />;
}
