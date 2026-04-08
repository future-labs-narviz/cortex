import { useState, useEffect } from "react";

export function StatusBar() {
  const [mcpConnected, setMcpConnected] = useState(false);

  useEffect(() => {
    // Simulate MCP connection check
    const timer = setTimeout(() => {
      setMcpConnected(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-between h-7 px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] select-none text-xs">
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">Cortex v0.1.0</span>
      </div>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              mcpConnected ? "bg-[var(--green)]" : "bg-[var(--red)]"
            }`}
          />
          <span className="text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
            MCP: {mcpConnected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
