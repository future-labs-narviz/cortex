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
      className="flex items-center select-none"
      style={{ height: 28, paddingLeft: 16, paddingRight: 16, borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: 12 }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cortex v0.1.0</span>
      <div style={{ width: 1, height: 10, background: 'var(--border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: mcpConnected ? 'var(--green)' : 'var(--text-muted)',
            flexShrink: 0,
            ...(mcpConnected ? { boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' } : {}),
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          MCP {mcpConnected ? "connected" : "disconnected"}
        </span>
      </div>
    </div>
  );
}
