---
title: Auth Module
tags: [project, auth, security]
created: 2026-03-01
status: active
---

# Auth Module

Authentication and authorization system.

## Evolution
1. Started with JWT tokens — see [[Decision - JWT vs Sessions]]
2. Switched to session-based auth after discovering refresh token complexity
3. Added OAuth via [[Decision - OAuth Provider Choice]]

## Components
- Session manager (Redis-backed)
- Password hashing (bcrypt, cost factor 12)
- OAuth 2.0 flow (Google, GitHub)
- RBAC permissions

## Security Considerations
- Rate limiting on login endpoints
- Account lockout after 5 failed attempts
- Session rotation on privilege escalation
- CSRF tokens for form submissions

## Related
- [[Payment System]] uses this for user verification
- [[Cortex App]] needs auth for future multi-user support
- [[Decision - JWT vs Sessions]] explains the pivot

#project #auth #security
