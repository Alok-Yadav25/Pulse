# Performance and verification

This file reports only observed local checks. **No Render/Neon load test, Lighthouse score, sustainable event rate, production memory measurement, or production uptime has been measured.**

The build command prints actual gzipped entry size and per-chunk sizes and fails if initial JS exceeds 200 KiB. Fonts are served locally. Chart code and secondary pages load on demand. The scaffold has no ingest endpoint, so beacon throughput cannot be tested yet.

Local verification on November 17, 2026, with Node 22.14.0 and Python 3.12.0:

| Check | Result |
| --- | --- |
| TypeScript strict check and ESLint | Passed |
| Vitest | 7 tests passed |
| Ruff and pytest | Passed; 5 backend tests |
| Alembic offline SQL | Foundation revision emits successfully |
| Production build | Passed |
| Initial JavaScript | 135.2 KiB gzip, measured by the build script |
| Deferred chart chunk | 119.7 KiB gzip |
| Deferred secondary pages | 7.7 KiB gzip |
| Runtime npm dependency audit | No reported vulnerabilities |
| Playwright smoke tests | 6 passed: 3 flows on desktop and mobile |
| Real API process | `/healthz` and `/api/meta` returned successful responses |

The browser flows cover intro and status-page rendering; dashboard range selection, search, and light-theme persistence; and monitor creation, reload persistence, and deletion. The mobile flow also verifies that wide table content does not expand the layout viewport. Desktop dark/light, intro, public status, mobile dashboard, and mobile dialog screenshots were reviewed. Browser tests run against the production build with reduced motion enabled.

The CI configuration is supplied but has not run on GitHub in this workspace. Docker and online Postgres migrations have not been tested locally because Docker is unavailable.

Later phases will measure ingest p95, sustained events per second, and resident memory against the deployed free instance using a reproducible load-test script. Until then, do not treat fixture values in the dashboard as performance claims.
