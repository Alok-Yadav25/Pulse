# ADR 0001: one API process

Status: accepted and implemented.

Pulse uses exactly one uvicorn worker. Its APScheduler jobs, bounded beacon buffer, live visitors, and SSE broker share that process. Multiple workers would duplicate scheduled checks and split live state. Durable configuration, incidents, counters, outbox deliveries and rollups remain in PostgreSQL. A lazy asyncpg pool has two connections and no overflow.

Heartbeat state detects service gaps after restarts. Unknown observation time reduces coverage rather than becoming target downtime. The external authenticated cron tick catches up bounded overdue work; it cannot reconstruct probes that never ran. Restarts discard live counters and any unflushed events. This design trades horizontal scale for a small deployment without Redis or a separate worker.
