---
title: "Decision: JWT vs Sessions"
tags: [decision, auth, security]
created: 2026-03-05
type: decision
status: decided
---

# Decision: JWT vs Sessions

## Context
[[Auth Module]] needed an authentication strategy.

## Options
1. **JWT tokens** — Stateless, scalable, but refresh token handling is complex
2. **Session-based** — Server-side state, simpler invalidation, Redis-backed

## Decision
Started with JWT, **switched to sessions** after 2 weeks.

## Why We Switched
- JWT refresh token rotation was error-prone
- Couldn't invalidate tokens on password change without a blacklist (which is just sessions with extra steps)
- Session-based auth with Redis is simpler and equally performant at our scale

## Lessons
- "Stateless" is a myth at scale — you always end up with server-side state
- Session invalidation is a feature, not a bug
- Don't choose JWT just because it's trendy

Related: [[Auth Module]], [[Payment System]]

#decision #auth #security
