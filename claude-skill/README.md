# Cortex - Claude Code Integration

Connect your Cortex knowledge graph to Claude Code.

## Quick Setup

1. Make sure the Cortex app is running
2. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

## Manual Setup

Add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "cortex": {
      "type": "http",
      "url": "http://localhost:3847/mcp"
    }
  }
}
```

## Usage

In Claude Code:
- `/cortex search <query>` - Search your knowledge graph
- `/cortex capture` - Capture an insight or decision
- `/cortex why <topic>` - Find why something was built a certain way
- `/cortex related <file>` - Find related notes
- `/cortex gaps` - Identify knowledge gaps

## Automatic Session Capture

Add hooks to `~/.claude/settings.json` to automatically capture development sessions. See `setup.sh` for the hook configuration.
