---
type: plan
title: Add a README to the test vault
status: ready
goal: Create a README.md file in the test vault root that describes what notes live there. List the three Wave notes in the sessions/ directory by name.
allowed_tools: ["Read", "Write", "Edit", "Bash(ls *)", "mcp__cortex__*"]
denied_tools: ["Bash(rm *)", "Bash(git *)"]
context_entities: ["Knowledge Graph", "Cortex"]
context_notes: ["sessions/2026-04-08_wave1-foundation.md"]
model: claude-sonnet-4-5
max_turns: 5
max_budget_usd: 1
permission_mode: acceptEdits
worktree: false
---

This is a small smoke test for Cortex Phase B.
