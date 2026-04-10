---
title: Claude Code Source Analysis
tags: [reference, claude-code, leaked, mcp]
created: 2026-04-08
---

# Claude Code Source Analysis

Analysis of the Claude Code source (leaked v2.1.19, at ~/Desktop/Handy/claude-code-leaked/).

## Key Findings
- **1,884 TypeScript files**, ~512K lines
- MCP client at `src/services/mcp/client.ts` (1000+ lines)
- Plugin system at `src/plugins/builtinPlugins.ts`
- Skill system at `src/skills/bundledSkills.ts`
- TeammateTool at `src/tools/TeamCreateTool/`
- Memory system at `src/memdir/memdir.ts`

## Integration Points Used in [[Cortex App]]
1. **MCP Server** — primary (7 tools, 3 resources)
2. **Custom Skill** — `/cortex` slash command
3. **Session Hooks** — auto-capture on session end
4. **Custom Agent** — `cortex-researcher` for knowledge synthesis

## What We Learned
- MCP is the right integration layer — see [[Decision - MCP vs Custom API]]
- Skills can wrap MCP calls with specialized prompts
- Hooks fire on 25+ lifecycle events
- Agent definitions support custom tools, models, memory

See [[MCP Integration Guide]] for implementation.

#reference #claude-code #analysis
