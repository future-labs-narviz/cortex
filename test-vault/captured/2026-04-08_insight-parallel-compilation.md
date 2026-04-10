---
type: captured-context
source: claude-code
tags: [insight, agents, compilation]
created: 2026-04-08T14:00:00Z
---

# Parallel Teams Compile on First Integration

Key insight from building [[Cortex App]]: when you give each agent team non-overlapping file ownership, the integration step is trivial. Waves 3 and 4 both had 4 parallel teams and both compiled on first `cargo check`.

The trick is defining shared interfaces (types, Tauri command signatures) BEFORE launching teams.

Related: [[Pattern - Parallel Agent Teams]]
