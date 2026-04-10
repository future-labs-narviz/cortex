---
title: "Pattern: Parallel Agent Teams"
tags: [pattern, agents, productivity]
created: 2026-04-08
type: pattern
---

# Pattern: Parallel Agent Teams

## Problem
Building a large application feature-by-feature is slow. Sequential development creates bottlenecks.

## Solution
Divide work into **waves** of parallel agent teams, each owning specific files with no overlap.

## How It Works
1. Define the wave's deliverables
2. Assign each team a specific set of files (no conflicts)
3. Define shared interfaces BEFORE launching teams
4. Launch all teams simultaneously as background agents
5. When all complete, integrate and verify (build + test)
6. Fix any integration issues
7. Move to next wave

## Example: [[Cortex App]]
- **Wave 3**: 4 parallel teams (Wikilinks, Backlinks, Search, MCP wiring)
- Each team owned specific crate/component directories
- All 4 compiled on first integration

## Key Rules
- **No file conflicts** — if two teams edit the same file, they'll clobber each other
- **Gate checks** — `cargo check` + `bun run build` between every wave
- **Shared types first** — define the interfaces before splitting work

## When to Use
- Projects with clear module boundaries
- Features that can be developed independently
- When you have access to parallel agent execution

## When NOT to Use
- Tightly coupled features that share state
- Exploratory work where the design isn't clear yet
- Small tasks (overhead of coordination isn't worth it)

Related: [[Cortex App]], [[Pattern - Self-Bootstrapping]]

#pattern #agents #productivity
