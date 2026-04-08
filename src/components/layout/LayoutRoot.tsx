import { useLayoutStore } from "@/stores/layoutStore";
import { LayoutNode } from "./LayoutNode";

export function LayoutRoot() {
  const root = useLayoutStore((s) => s.root);
  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <LayoutNode node={root} />
    </div>
  );
}
