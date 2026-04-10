---
type: retrospective
session_id: e2e-test-002
---

# Session Retrospective: e2e-test-002

## Summary
A connection pooling solution was implemented in src/db/client.rs by replacing direct tokio-postgres usage with deadpool-postgres. The pool was configured with a maximum size of 16 connections and a 30-second idle timeout using Pool::builder().max_size(16).recycle_timeout(Some(Duration::from_secs(30))). This change resolved the idle connection leak problem that had accumulated connections up to ~200, reducing the active connection count to approximately 16. The fix works because deadpool-postgres explicitly manages connection lifecycle rather than relying on tokio-postgres's per-call connect/disconnect pattern, preventing connection accumulation over time.

## What Worked
- deadpool-postgres connection pool successfully reduced idle connections from ~200 to ~16
- Pool::builder() configuration with max_size(16) and recycle_timeout(Some(Duration::from_secs(30))) effectively manages connection lifecycle
- Explicit connection lifecycle tracking in deadpool-postgres prevents connection accumulation compared to per-call connect/disconnect in tokio-postgres

## What Failed
- Direct use of tokio-postgres resulted in idle connection leak accumulating to ~200 connections
- Per-call connect/disconnect pattern in tokio-postgres did not properly clean up unused connections

## Key Decisions
- Adopt deadpool-postgres for connection pooling in src/db/client.rs
- Set max pool size to 16 connections
- Set idle connection timeout to 30 seconds using recycle_timeout
