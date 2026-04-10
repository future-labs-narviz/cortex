---
title: "Pattern: Self-Bootstrapping"
tags: [pattern, meta, productivity]
created: 2026-04-08
type: pattern
---

# Pattern: Self-Bootstrapping

## Problem
Tools for capturing development process don't get tested with real data until they're "done."

## Solution
Use the tool to build the tool. The development process becomes the first dataset.

## How It Works in [[Cortex App]]
After Wave 1 (MCP server running), every subsequent wave used Cortex:
- Wave 3: Used `cortex/search` while building the search engine
- Wave 4: Session capture started recording how we built the capture system
- Wave 5: Voice notes for ideation about voice features

## Benefits
- Tool gets tested with real data from day one
- Bugs discovered in context of actual use
- The "how Cortex was built" story becomes the demo
- Proves the concept to stakeholders

## Risks
- Circular dependency (tool broken → can't build tool)
- Temptation to polish instead of build
- Need a fallback workflow when the tool is down

#pattern #meta #self-bootstrapping
