# ADR 0003: authenticated SSE and bounded process state

Status: accepted and implemented.

One API worker owns the scheduler, active visitor counters, beacon buffer, and live queues. Redis and extra workers are excluded by the free-hosting constraints. Clients use fetch-based SSE with a bearer header so tokens do not enter URLs or logs. Fifty clients and 64 messages per queue cap memory, and slow clients disconnect. REST polling remains available during reconnects.

Durable checks and state transitions live in Postgres. Ephemeral counters rebuild from subsequent visible-tab heartbeats. The beacon buffer accepts at most 1,000 events and flushes every two seconds or 100 events; process crashes can lose the unflushed tail. This is not exactly-once ingestion.
