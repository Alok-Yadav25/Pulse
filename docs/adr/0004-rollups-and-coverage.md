# ADR 0004: bounded rollups and observed coverage

Status: accepted and implemented.

Minute and hour aggregates share one table with a unique site/bucket/resolution index. Buckets are replaced atomically for idempotency. Completed hourly samples support retained percentile calculations; bounded top dimensions use Other for omitted counts. Repeated hourly visitors cannot be deduplicated after raw events expire and are explicitly approximate.

Availability uses time-weighted observed checks capped to one cadence. Gaps and maintenance are unioned and removed from eligible time. Unknown observation time reduces coverage instead of creating downtime. Partial boundary buckets can be omitted; that missing time is reported through coverage.

Privacy TTLs take priority over catch-up: raw events expire after 48 hours and checks after seven days at the next maintenance pass. An extended outage or aggregation backlog can therefore leave historical gaps. Bounded row counts, daily event quotas, dimension compaction, and a 400 MiB database-pressure guard protect free-tier headroom.
