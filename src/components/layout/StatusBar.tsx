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
    <div
      className="flex items-center justify-between h-7 px-3 py-1.5 border-t border-[var(--border)] bg-[var(--muted)] select-none text-xs"
      style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)]">Cortex v0.1.0</span>
      </div>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              mcpConnected ? "bg-[var(--green)]" : "bg-[var(--red)]"
            }`}
            style={mcpConnected ? { boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' } : undefined}
          />
          <span className="text-xs text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
            MCP: {mcpConnected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
