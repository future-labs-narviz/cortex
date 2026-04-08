import { useState, useCallback, type CSSProperties } from "react";
import {
  Plug,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  Zap,
} from "lucide-react";

interface ConnectionStatus {
  state: "idle" | "checking" | "connected" | "disconnected";
  message: string;
}

const MCP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      cortex: {
        type: "http",
        url: "http://localhost:3847/mcp",
      },
    },
  },
  null,
  2,
);

const HOOK_CONFIG = JSON.stringify(
  {
    hooks: {
      Stop: [
        {
          matcher: "",
          command:
            'curl -sf -X POST http://localhost:3847/api/capture/session-end -H \'Content-Type: application/json\' -d \'{"ended_at":"\'$(date -u +%Y-%m-%dT%H:%M:%SZ)\'"}\'  2>/dev/null || true',
        },
      ],
    },
  },
  null,
  2,
);

/* Reusable styles */
const card: CSSProperties = {
  background: 'var(--muted)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 16,
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontFamily: '"JetBrains Mono", monospace',
  marginBottom: 12,
};

const codeBlock: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  fontFamily: '"JetBrains Mono", monospace',
  lineHeight: 1.7,
  padding: 12,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
};

export function IntegrationSettings() {
  const [status, setStatus] = useState<ConnectionStatus>({
    state: "idle",
    message: "Not checked",
  });
  const [copied, setCopied] = useState<"mcp" | "hook" | null>(null);
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [hooksExpanded, setHooksExpanded] = useState(false);

  const testConnection = useCallback(async () => {
    setStatus({ state: "checking", message: "Checking..." });
    try {
      const res = await fetch("http://localhost:3847/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      });
      if (res.ok) {
        const data = await res.json();
        const toolCount = data?.result?.tools?.length ?? 0;
        setStatus({ state: "connected", message: `Connected (${toolCount} tools)` });
      } else {
        setStatus({ state: "disconnected", message: `Server responded ${res.status}` });
      }
    } catch {
      setStatus({ state: "disconnected", message: "Could not reach server" });
    }
  }, []);

  const copyToClipboard = useCallback(
    async (text: string, label: "mcp" | "hook") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        console.warn("[Cortex] Clipboard write failed");
      }
    },
    [],
  );

  const statusDotColor =
    status.state === "connected" ? "var(--green)"
    : status.state === "disconnected" ? "var(--red)"
    : "var(--text-muted)";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Plug style={{ width: 18, height: 18, color: 'var(--accent)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Claude Code Integration
        </span>
      </div>

      {/* MCP Server Status */}
      <div style={card}>
        <div style={sectionLabel}>Server Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusDotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
            {status.message}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
            :3847
          </span>
        </div>
        <button
          onClick={testConnection}
          disabled={status.state === "checking"}
          className="btn-primary text-white border border-[rgba(255,255,255,0.12)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 36, fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
        >
          <RefreshCw
            style={{ width: 14, height: 14 }}
            className={status.state === "checking" ? "animate-spin" : ""}
          />
          Test Connection
        </button>
      </div>

      {/* MCP Configuration */}
      <div style={card}>
        <div style={sectionLabel}>MCP Configuration</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <pre style={codeBlock}>{MCP_CONFIG}</pre>
          <button
            onClick={() => copyToClipboard(MCP_CONFIG, "mcp")}
            style={{ position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex' }}
            title="Copy"
          >
            {copied === "mcp" ? (
              <Check style={{ width: 12, height: 12, color: 'var(--green)' }} />
            ) : (
              <Copy style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
            )}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Add to your project's <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>.mcp.json</code> file.
        </p>
      </div>

      {/* Expandable: Setup Instructions */}
      <div style={card}>
        <button
          onClick={() => setSetupExpanded(!setupExpanded)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          {setupExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          Setup Instructions
        </button>
        {setupExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 22, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p>1. Make sure the Cortex app is running</p>
            <p>2. Copy the MCP configuration above</p>
            <p>3. Restart Claude Code to load the server</p>
            <p>4. Test with <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>/cortex search query</code></p>
          </div>
        )}
      </div>

      {/* Expandable: Session Capture Hooks */}
      <div style={card}>
        <button
          onClick={() => setHooksExpanded(!hooksExpanded)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          {hooksExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
          Session Capture Hooks
        </button>
        {hooksExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 22 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Add to <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>settings.json</code> for auto-capture:
            </p>
            <div style={{ position: 'relative' }}>
              <pre style={codeBlock}>{HOOK_CONFIG}</pre>
              <button
                onClick={() => copyToClipboard(HOOK_CONFIG, "hook")}
                style={{ position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex' }}
                title="Copy"
              >
                {copied === "hook" ? (
                  <Check style={{ width: 12, height: 12, color: 'var(--green)' }} />
                ) : (
                  <Copy style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={card}>
        <div style={sectionLabel}>Capture Statistics</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <Zap style={{ width: 16, height: 16, color: 'var(--accent)', marginBottom: 6 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>--</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sessions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <Activity style={{ width: 16, height: 16, color: 'var(--accent)', marginBottom: 6 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>--</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Insights</span>
          </div>
        </div>
      </div>

    </div>
  );
}
