# Pulse

Website health, performance, and privacy-conscious visitor analytics in a vivid, responsive signal studio.

**Working locally:** FastAPI + PostgreSQL + React/Vite. Live mode includes timed public-URL probes, confirmed incidents, authenticated SSE, tracker ingestion, analytics, public status pages and badges, maintenance windows, release markers, assertions, grouped Slack/Discord/Telegram/webhook alerts, and incident reports. Sample mode is explicit and never replaces live data after an API error. No external deployment has been performed, as requested.

[Hero](docs/previews/landing.png) · [Dashboard](docs/previews/dashboard-dark.png) · [Light theme](docs/previews/dashboard-light.png) · [Landing](docs/previews/landing.png) · [Mobile](docs/previews/dashboard-mobile.png) · [Traffic](docs/previews/traffic.png)

## Run everything locally

Requires **Python 3.12 and Node 22**:

```sh
python3 scripts/dev.py
```

Or `npm run dev:all` from the repository root. The helper bootstraps missing dependencies, runs a native local Postgres process, applies migrations, and starts exactly one API worker plus Vite. Postgres files persist in `.local/postgres`; development secrets live in ignored environment configuration. Ctrl+C shuts down the owned services. No Docker account or cloud credentials are required.

- Landing: **http://localhost:5173** (also `/welcome`)
- Dashboard: **http://localhost:5173/dashboard**
- API explorer: **http://localhost:8000/docs**
- Cheap liveness: `/healthz`; configuration and database readiness: `/readyz`.

From the dashboard, click **Connect live → Create account** to save real monitors. Add the complete URL, including any endpoint path and query. Configure tags, groups, response assertions, public status, alerts, maintenance, releases, and the tracker in its settings.

**Connect live → Try the live chaos demo** creates a read-only controlled monitor. **Break it** causes a bounded 45-second failure. Three failed checks open an incident; two successes close it. The demo uses a controlled in-process target, not a probe to an arbitrary private address.

The sample workspace remains available without an API. Sample-only monitors are stored in the browser and do not issue probes. `/status/acme` is a reserved illustrative page; real public pages use the slug returned for each opted-in monitor.

## Verify

```sh
cd web
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:smoke
npm run test:lighthouse
```

Browser tests require a running Postgres schema and environment secrets. The full local helper supplies an API; for isolated testing, point `BROWSER_DATABASE_URL` at a **disposable database with migrations already applied** and stop an existing API before starting the test runner. CI provisions isolated Postgres instances automatically. Lighthouse needs Chrome/Chromium; set `CHROME_PATH` if it is not discovered.

```sh
cd backend
source .venv/bin/activate
ruff check .
TEST_DATABASE_URL='postgresql+asyncpg://…/pulse_test' pytest -q
```

Integration tests reset only the explicitly provided disposable test database; without TEST_DATABASE_URL those tests skip. CI checks migrations up/down/up against a fresh Postgres service. See [measured local results](docs/PERFORMANCE.md), [security boundaries](docs/SECURITY.md), and [storage limits](docs/STORAGE.md).

## Honest limits

One process, at most 10 real monitors across this free-tier-oriented deployment, 10 accounts, 50 SSE clients, and 5,000 accepted tracker events per site per UTC day by default. Live visitor counters and the 2-second beacon buffer are ephemeral. No multi-region probing or production capacity claim is made. Historical traffic dimensions are compacted; unique visitor sums beyond raw retention are approximate. Tracker INP is an estimate over at most 500 recent interactions. Profiles use local rules; no LLM request is made.

Docker Compose and future Render/Cloudflare manifests are included, but Docker execution and hosted behavior have not been verified in this environment. [DEPLOY.md](DEPLOY.md) separates local setup from optional future deployment.
