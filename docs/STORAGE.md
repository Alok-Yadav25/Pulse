# Storage budget and retention

Defaults target a small, single-process installation: **10 real monitors across the deployment**, 10 registered accounts, and 5,000 accepted tracker events per site per UTC day. The controlled demo is additional and uses the same retention cleanup. The deployment-wide monitor cap is deliberately stricter than a per-user cap because all accounts share one database.

| Data | Retention / bound |
| --- | --- |
| Raw checks, including demo | 7 days |
| Raw RUM | 48 hours |
| Minute rollups | 7 days |
| Hourly rollups | 90 days |
| Resolved incidents | 90 days and latest 100 per site; open incidents retained |
| Alert deliveries | 90 days and latest 1,000 per site |
| Releases and maintenance records | 90 days and latest 100 per site |
| Alert channels | 3 per site |

The maintenance pass runs each minute, or through the authenticated cron tick. TTL deletion occurs at that pass; it cannot run while the process is stopped. Privacy TTLs take priority over an aggregation backlog. After a long shutdown, some raw data may expire before rollup catch-up completes. Historical coverage exposes missing observation time.

## Planning math

The following are **planning assumptions including approximate row/index overhead, not measured row-size guarantees**. JSON sizes, index fill, dead tuples and PostgreSQL page allocation vary with actual data. Estimates use ten sites at the default 60-second cadence:

```text
raw checks:   10 × 1,440/day × 7 days × 400 B     ≈ 38.5 MiB
raw RUM:      10 × 5,000/day × 2 days × 800 B     ≈ 76.3 MiB
minute rows:  10 × 1,440/day × 7 days × 1,024 B   ≈ 98.4 MiB
hourly rows:  10 × 24/day × 90 days × 2,048 B     ≈ 42.2 MiB
planning subtotal                              ≈ 255.4 MiB
```

At the minimum 30-second cadence, the raw-check estimate doubles to about 76.9 MiB. Latency arrays also grow. Empty-traffic rollups omit traffic data. These assumptions leave headroom under a 0.5 GB budget, but unusual labels or JSON, bloat, a sustained demo, and provider accounting can invalidate the estimate. This is not a claim that every allowed workload fits below 0.5 GB.

Rollups share one table with a unique site/bucket/resolution index. Minute traffic retains the top two labels per page/referrer/timezone dimension (32 UTF-8 bytes each); hourly traffic retains four (64 bytes each). Omitted counts are combined under Other. Latency samples are capped at 720 per hour. Label truncation and Other intentionally sacrifice historical detail; old unique-visitor counts sum hourly estimates and can overcount returning people.

Every maintenance pass checks `pg_database_size(current_database())`. At **400 MiB**, ingestion pauses with HTTP 429 until storage pressure clears. This guard protects RUM headroom; it is not a hard PostgreSQL disk quota, and probes/rollups still write. Deleted PostgreSQL pages are reusable but filesystem size may not shrink immediately. Check actual relation size and bloat before increasing quotas or relying on a small hosted storage allowance:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

The two-second in-memory ingest buffer holds at most 1,000 events; it is not durable. Per-site daily quotas include pageviews, vitals and heartbeats, and reserve capacity before buffering. Restarts can lose accepted buffered events while the reserved quota remains consumed. No raw IP address or raw user agent is stored in analytics tables.
