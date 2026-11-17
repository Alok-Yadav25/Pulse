# Storage plan — not yet measured

Phase 0 creates no monitoring tables. The numbers below are planning estimates, not measured PostgreSQL row sizes. Validate with `pg_total_relation_size` once the schema and representative traffic exist.

Assume 10 sites, one check per 60 seconds, approximately 240 bytes per check including indexes:

```text
checks/day = 10 × 1,440 = 14,400
7-day raw check estimate = 100,800 × 240 = 24,192,000 bytes ≈ 23.1 MiB
```

RUM needs an explicit ingestion budget; a short TTL alone does not guarantee staying under 0.5 GB. At 100,000 events/day and an assumed 400 bytes/event including indexes:

```text
48-hour raw RUM estimate = 200,000 × 400 = 80,000,000 bytes ≈ 76.3 MiB
```

For two rollup kinds per site, assuming approximately 400 bytes including indexes:

```text
7-day minute rollups = 10 × 1,440 × 7 × 2 × 400 ≈ 76.9 MiB
90-day hourly rollups = 10 × 24 × 90 × 2 × 400 ≈ 16.5 MiB
subtotal ≈ 192.8 MiB
```

Reserve at least another 150 MiB for visitors beyond this assumed traffic budget, incidents, profiles, index overhead variance, dead tuples, and operational headroom. Rollup dimensions and `extras` JSON must be bounded; arbitrary path cardinality would invalidate this estimate. Per-key event quotas and database-size monitoring must be implemented before enabling RUM. Review actual provider storage units and overhead after seeding the first real dataset.
