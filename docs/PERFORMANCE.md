# Performance and verification

These results describe the local production preview on macOS arm64 with Node 22.14 and Python 3.12. They do not establish Render/Neon performance, sustained capacity, or production uptime. No external deployment was performed.

| Check | Observed result |
| --- | --- |
| TypeScript strict check and ESLint | Passed |
| Vitest | 12 tests passed |
| Ruff and pytest, including real PostgreSQL integration | 86 tests passed |
| Alembic on a disposable PostgreSQL database | Upgrade, downgrade to base, upgrade passed |
| Playwright production-build tests | 11 passed across desktop, mobile, and live workflows |
| Automated WCAG A/AA checks | No axe violations on landing and dashboard, desktop and mobile |
| Landing Lighthouse, default mobile throttling, three runs | Performance 100 / 99 / 99; accessibility, best practices and SEO 100 in each run |
| Landing LCP / CLS | 1.77–1.81 seconds / 0 in all three runs |
| JavaScript entry | 62.4 KiB gzip |
| All JavaScript, including every deferred route and chart | About 159.4 KiB gzip; build fails above 200 KiB |
| Native SVG chart chunk | 2.1 KiB gzip |
| Dependency-free tracker | 1,284 bytes gzip; build fails above 2,048 bytes |
| Runtime dependency audits | No known vulnerabilities reported by npm audit --omit=dev and pip-audit against the runtime lock |

Browser tests cover sample persistence, full URL preservation, dark/light themes, range changes, keyboard chart inspection, stacked probe phases, responsive layout, real registration/configuration, releases, maintenance, controlled incident opening/recovery, actual tracker ingestion, stripped query strings, SPA navigation, and Do Not Track. The linked dashboard, landing, and status screenshots in `docs/previews` come from these runs. Axe and Lighthouse are automated evidence, not a complete manual accessibility certification.

The independent landing bundle and CSS do not fetch monitoring data. Fonts are local and use optional display; charts use native SVG. The entry budget is intentionally supplemented by an all-chunks budget so lazy loading cannot conceal an oversized application.

## Local ingestion diagnostic

Run an API and PostgreSQL locally, then from the repository root:

```sh
backend/.venv/bin/python loadtest/local_ingest.py --rates 1 2 4 --seconds 10 --pid <API_PID>
```

The harness accepts only loopback URLs, registers a disposable test account and monitor, sends three events per request, measures client latency, samples API RSS every 0.5 seconds, and deletes the monitor afterward. It leaves the local test account. Repeated runs may reach the account quota; use a disposable local database.

The latest saved run used three ten-second stages:

| Requests/s | Accepted events/s | Accepted requests | Client p50 | Client p95 |
| --- | --- | --- | --- | --- |
| 1 | 3 | 10/10 | 11.97 ms | 18.62 ms |
| 2 | 6 | 20/20 | 10.15 ms | 28.01 ms |
| 4 | 12 | 40/40 | 11.96 ms | 19.46 ms |

All 70 requests returned 202. Sampled API RSS started at 55.30 MiB and peaked at 97.81 MiB. These short loopback bursts ran on a developer machine, alongside other local activity. They do not prove a sustainable event rate, a 300 MiB ceiling under all workloads, or free-tier hosting capacity. A 202 reserves quota and queues events; it does not mean that PostgreSQL has already committed them.

Machine-readable evidence: [Lighthouse](lighthouse-local.json), [local ingestion](local-load-results.json). Reproduce Lighthouse with `cd web && npm run test:lighthouse`; set CHROME_PATH to an installed Chromium executable if necessary.

GitHub Actions configuration includes PostgreSQL integration, migration cycling, browser tests, tracker/bundle budgets, and Lighthouse assertions. Remote CI, Docker execution, real provider webhook delivery, and hosted load tests have not been run from this workspace.
