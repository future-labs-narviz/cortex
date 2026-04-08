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
    <div className="flex items-center justify-between h-6 px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] select-none text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">Cortex v0.1.0</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              mcpConnected ? "bg-[var(--green)]" : "bg-[var(--red)]"
            }`}
          />
          <span className="text-[var(--text-muted)]">
            MCP: {mcpConnected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
