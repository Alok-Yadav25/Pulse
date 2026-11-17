# Architecture

## Implemented in phase 0

```text
React 18 + TypeScript + Vite
  ├─ Static dashboard, intro, sample status page
  ├─ Deterministic, explicitly labeled sample data
  ├─ localStorage: theme, workspace name, pending monitors
  └─ Deferred chart + secondary-page chunks

FastAPI, Python 3.12, one uvicorn worker
  ├─ GET /healthz: no database or outbound requests
  ├─ GET /api/meta: actual capabilities only
  ├─ Explicit CORS allowlist and response headers
  └─ Lazy SQLAlchemy/asyncpg pool, Alembic foundation revision
```

The dashboard does not yet fetch server data. TanStack Query is configured for later API hooks; Radix manages accessible dialogs, cmdk manages search, and Framer Motion respects reduced motion. Recharts loads separately from the initial bundle.

## Planned feature phases

One process will own a bounded SSE broker, an async probe scheduler, and batched tracker ingestion. Postgres will store checks, incidents, raw RUM, profiles, rollups, and monitor gaps. There is no Redis or separate worker. All target-site requests must use an SSRF-safe pinned-IP client before any probing or profiling feature is enabled.

The externally triggered cron route, gap accounting, and real monitoring are not implemented in the scaffold. There is no production readiness, load, memory, or uptime claim.

## Design direction

Graphite surfaces, a soft mint accent, restrained lilac/blue/peach series colors, self-hosted Inter and JetBrains Mono. Spacing uses a compact dashboard scale, with deliberate hierarchy and simple chart styling. Dark and light themes share tokens. Gradients support hierarchy; animated glow is limited to demo/live indicators. The intro uses a one-time heartbeat drawing. System reduced-motion preferences disable ornamental animation.
