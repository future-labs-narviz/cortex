import { useState, useCallback } from "react";
import {
  Plug,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
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
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 1,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const toolCount =
          data?.result?.tools?.length ?? 0;
        setStatus({
          state: "connected",
          message: `Connected (${toolCount} tools available)`,
        });
      } else {
        setStatus({
          state: "disconnected",
          message: `Server responded with ${res.status}`,
        });
      }
    } catch {
      setStatus({
        state: "disconnected",
        message: "Could not reach MCP server",
      });
    }
  }, []);

  const copyToClipboard = useCallback(
    async (text: string, label: "mcp" | "hook") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        console.warn("[Cortex] Failed to copy to clipboard");
      }
    },
    [],
  );

  const statusColor =
    status.state === "connected"
      ? "var(--green)"
      : status.state === "disconnected"
        ? "var(--red)"
        : "var(--text-muted)";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 mb-1">
        <Plug size={18} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Claude Code Integration
        </h3>
      </div>

      {/* MCP Server Status */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">
          MCP Server Status
        </label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--border)]">
            <div
              className="w-2 h-2 rounded-[var(--radius-full)] flex-shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-sm text-[var(--text-secondary)] flex-1">
              {status.message}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Port 3847
            </span>
          </div>
          <button
            onClick={testConnection}
            disabled={status.state === "checking"}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm rounded-[var(--radius-lg)] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors duration-150 ease-in-out cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            <RefreshCw
              size={14}
              className={status.state === "checking" ? "animate-spin" : ""}
            />
            Test Connection
          </button>
        </div>
      </div>

      {/* Copy MCP Config */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">
          MCP Configuration
        </label>
        <div className="flex flex-col gap-2">
          <div className="relative">
            <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words font-mono leading-relaxed p-3 rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--border)]">
              {MCP_CONFIG}
            </pre>
            <button
              onClick={() => copyToClipboard(MCP_CONFIG, "mcp")}
              className="absolute top-2 right-2 p-1.5 rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--muted)] transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              title="Copy MCP config"
            >
              {copied === "mcp" ? (
                <Check size={12} className="text-[var(--green)]" />
              ) : (
                <Copy size={12} className="text-[var(--text-muted)]" />
              )}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Add this to your project&apos;s <code>.mcp.json</code> file.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <button
          onClick={() => setSetupExpanded(!setupExpanded)}
          className="flex items-center gap-1.5 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--muted)] cursor-pointer transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded-[var(--radius-md)] w-full"
        >
          {setupExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          Setup Instructions
        </button>
        {setupExpanded && (
          <div className="flex flex-col gap-2 mt-2 pl-5 text-xs text-[var(--text-secondary)]">
            <p>1. Make sure the Cortex app is running</p>
            <p>
              2. Navigate to the <code>claude-skill/</code> directory in Cortex
            </p>
            <p>3. Run the setup script:</p>
            <pre className="text-[11px] font-mono bg-[var(--bg-primary)] p-3 rounded-[var(--radius-lg)] border border-[var(--border)]">
              {`chmod +x setup.sh\n./setup.sh`}
            </pre>
            <p>
              4. Restart Claude Code to load the skill
            </p>
            <p>
              5. Use <code>/cortex search &lt;query&gt;</code> to test
            </p>
          </div>
        )}
      </div>

      {/* Hook Configuration */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <button
          onClick={() => setHooksExpanded(!hooksExpanded)}
          className="flex items-center gap-1.5 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--muted)] cursor-pointer transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded-[var(--radius-md)] w-full"
        >
          {hooksExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          Session Capture Hooks
        </button>
        {hooksExpanded && (
          <div className="flex flex-col gap-2 mt-2 pl-5">
            <p className="text-xs text-[var(--text-muted)]">
              Add to <code>~/.claude/settings.json</code> for automatic session
              capture:
            </p>
            <div className="relative">
              <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words font-mono leading-relaxed p-3 rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--border)]">
                {HOOK_CONFIG}
              </pre>
              <button
                onClick={() => copyToClipboard(HOOK_CONFIG, "hook")}
                className="absolute top-2 right-2 p-1.5 rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--muted)] transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                title="Copy hook config"
              >
                {copied === "hook" ? (
                  <Check size={12} className="text-[var(--green)]" />
                ) : (
                  <Copy size={12} className="text-[var(--text-muted)]" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Stats */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">
          Capture Statistics
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-4 rounded-[var(--radius-xl)] bg-[var(--muted)] border border-[var(--border)]">
            <Activity size={16} className="text-[var(--accent)] mb-1.5" />
            <span className="text-2xl font-semibold text-[var(--text-primary)]">
              --
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Sessions
            </span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-[var(--radius-xl)] bg-[var(--muted)] border border-[var(--border)]">
            <Activity size={16} className="text-[var(--accent)] mb-1.5" />
            <span className="text-2xl font-semibold text-[var(--text-primary)]">
              --
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Insights
            </span>
          </div>
        </div>
      </div>

      {/* Open Skill Directory */}
      <button
        onClick={() => {
          // Use Tauri shell open to reveal the directory
          import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("open_in_explorer", {
              path: "claude-skill",
            }).catch(() => {
              console.warn("[Cortex] Could not open skill directory");
            });
          });
        }}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm rounded-[var(--radius-lg)] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--muted)] transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <ExternalLink size={12} />
        Open Skill Directory
      </button>
    </div>
  );
}
