#!/bin/bash
# Cortex - Claude Code Integration Setup
# This script configures Claude Code to connect to your Cortex app.

set -e

CORTEX_PORT="${CORTEX_PORT:-3847}"
CORTEX_URL="http://localhost:${CORTEX_PORT}"

echo "🧠 Cortex - Claude Code Integration Setup"
echo "==========================================="
echo ""

# Check if Cortex MCP server is reachable
echo "Checking Cortex MCP server at ${CORTEX_URL}/mcp..."
if curl -s -X POST "${CORTEX_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | grep -q "cortex/search"; then
  echo "✅ Cortex MCP server is running"
else
  echo "⚠️  Cortex MCP server not detected. Make sure the Cortex app is running."
  echo "   The MCP tools will connect when Cortex starts."
fi

echo ""

# Create/update MCP config
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_CONFIG_FILE="${SKILL_DIR}/.mcp.json"

cat > "$MCP_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "cortex": {
      "type": "http",
      "url": "${CORTEX_URL}/mcp"
    }
  }
}
EOF

echo "✅ Created MCP config at ${MCP_CONFIG_FILE}"

# Install skill to Claude Code
CLAUDE_SKILLS_DIR="${HOME}/.claude/skills"
mkdir -p "$CLAUDE_SKILLS_DIR"

if [ -L "${CLAUDE_SKILLS_DIR}/cortex" ] || [ -d "${CLAUDE_SKILLS_DIR}/cortex" ]; then
  rm -rf "${CLAUDE_SKILLS_DIR}/cortex"
fi
ln -s "$SKILL_DIR" "${CLAUDE_SKILLS_DIR}/cortex"
echo "✅ Installed skill to ${CLAUDE_SKILLS_DIR}/cortex"

# Set up session hooks
echo ""
echo "To enable automatic session capture, add these hooks to ~/.claude/settings.json:"
echo ""
cat << 'HOOKS'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "command": "curl -sf -X POST http://localhost:3847/api/capture/session-end -H 'Content-Type: application/json' -d '{\"ended_at\":\"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}' 2>/dev/null || true"
      }
    ]
  }
}
HOOKS

echo ""
echo "🎉 Setup complete! Use /cortex in Claude Code to access your knowledge graph."
echo ""
echo "Quick test: In Claude Code, try:"
echo "  /cortex search authentication"
echo "  /cortex capture"
