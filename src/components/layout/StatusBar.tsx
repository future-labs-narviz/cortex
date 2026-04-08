import { useState, useEffect } from "react";

export function StatusBar() {
  const [mcpConnected, setMcpConnected] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMcpConnected(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex items-center h-7 px-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] select-none text-[11px] gap-4"
      style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
    >
      <span className="text-[var(--text-muted)]">Cortex v0.1.0</span>
      <div className="w-px h-3 bg-[var(--border)]" />
      <div className="flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            mcpConnected ? "bg-[var(--green)]" : "bg-[var(--text-muted)]"
          }`}
          style={mcpConnected ? { boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' } : undefined}
        />
        <span className="text-[var(--text-muted)]">
          MCP {mcpConnected ? "connected" : "disconnected"}
        </span>
      </div>
    </div>
  );
}
