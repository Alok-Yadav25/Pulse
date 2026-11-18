# Architecture

```text
Browser with tracker ── text/plain beacons ──┐
React dashboard ── bearer REST + fetch SSE ──┤
                                           ▼
                     FastAPI / one uvicorn process
  public-IP pinned probe client │ APScheduler │ bounded SSE broker
  2-second beacon batch buffer   │ visitor TTL │ grouped alert outbox
  maintenance + incident state  │ rollups     │ storage guard
                                           │
                               SQLAlchemy 2 / asyncpg
                                           │
                                      PostgreSQL
```

The native local helper owns Postgres, the API, and Vite. Cloud deployment is optional and has not been performed. Production configuration targets one Render worker, Neon Postgres, and Cloudflare Pages.

## Request and background behavior

Targets are normalized without dropping paths or queries. DNS validation checks every A/AAAA answer, rejects non-public destinations and ambiguous URL forms, and connects only to a validated IP. Host and SNI retain the original hostname. Redirects are revalidated, the entire probe has a 10-second deadline, and concurrency is capped at ten. The response-body cap is 1 MiB per response; redirects are limited to three. DNS, TCP, TLS, TTFB, and total elapsed times are measured from the service's single location. Phase values are outside-in client observations, not browser DevTools timings.

Probe state persists in Postgres. A failed UP check schedules retries five seconds apart. The third failure opens an incident; two successes close it. A maintenance window continues checks while suppressing new incident transitions and alerts. All checks persist with a maintenance flag.

The same lock-guarded tick serves internal maintenance and secret-authenticated external cron. A durable 15-second heartbeat detects gaps longer than 120 seconds. Per-check coverage is capped at its cadence; absence of observations never creates target downtime. Overlapping gaps and maintenance are unioned before subtraction.

SSE uses one bounded 64-entry queue per client and a process-wide cap of 50 clients. Slow clients are disconnected, heartbeats are sent every 20 seconds, and the browser reconnects while REST polling remains available. Authorization is a bearer header, never a query-string token. Live errors preserve owner-scoped cached snapshots and never switch to sample fixtures.

Ingestion validates exact Origin, strips queries and referrer paths, enforces payload/rate/daily quotas, and buffers at most 1,000 events. It flushes at 100 events or every two seconds. A crash can lose accepted but unflushed events; there is no durable queue. The buffer is cleared for a deleted site before another flush can reference it.

## Analytics and presentation

Percentiles use actual recorded observations. The overview endpoint computes whole-workspace percentiles from the complete retained population, independently of bounded chart sampling. SVG charts display up to the recent retained chart limit; overview display buckets show means, while period percentile thresholds use the full population. A keyboard-accessible table exposes raw chart observations.

Minute and hourly records share a single `rollups` table keyed by site, bucket, and resolution. Hourly latency samples retain exact order statistics within the bounded sample budget. Partial buckets at the raw/rollup boundary are omitted and reduce reported coverage. Older traffic rankings are compacted with an Other bucket, hourly visitor uniques can overcount repeat visitors, and Web Vitals remain labeled with the available raw-event window.

The landing bundle contains only the introduction, brand primitives, router, and shared styles. The dashboard, settings, dialogs, and charts load separately. A build check budgets **all JavaScript chunks combined**, preventing a lazy-import loophole. Sora display type and Manrope interface/data type are self-hosted and preloaded; JetBrains Mono is reserved for technical snippets. The default `/` and `/welcome` routes show the independent landing page; the workspace lives at `/dashboard`. Both themes, reduced motion, mobile navigation focus management, and chart keyboard controls are implemented.

Charts default to layered timing areas with an explicit phase legend and a separate total-response view. Concentric health rings show independent ratios; audience rings and donuts show population shares. Page-view columns use ranked path categories rather than inventing a temporal series. All chart views share keyboard-accessible labels and measured or clearly labeled sample data.
