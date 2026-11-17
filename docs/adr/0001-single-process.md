# ADR 0001: one API process

Status: accepted for the scaffold.

The target is one free Render web service, without a paid background worker or Redis. All supplied start commands use exactly one uvicorn worker. The eventual scheduler, live counters, and SSE queues must live in that process. Multiple workers would create divergent in-memory counters and duplicate scheduled work.

The current phase implements health and metadata only. The database pool is created lazily and capped at two connections with no overflow. Scheduling and the event broker remain later-phase work. Service restarts will clear in-memory state; durable records must remain in Postgres. Sleep gaps must eventually be recorded rather than counted as target downtime.
