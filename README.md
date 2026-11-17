# Pulse

A quieter workspace for website uptime, performance, and visitors.

**Current state: phase 0 review preview.** The React interface is interactive and all monitoring numbers are illustrative. The FastAPI service exposes health and capability metadata. Live probes, accounts, ingestion, incidents, and analytics are not implemented yet. No production deployment has been performed.

Design previews: [dark dashboard](docs/previews/dashboard-dark.png) · [light dashboard](docs/previews/dashboard-light.png) · [landing](docs/previews/landing.png) · [mobile](docs/previews/dashboard-mobile.png) · [status page](docs/previews/status.png).

## Run locally

Requires Node 22 and Python 3.12. For the dashboard:

```sh
cd web
npm ci
npm run dev
```

Open **http://localhost:5173**. The introduction is at `/welcome`; the sample public status page is at `/status/acme`.

For the API in another terminal:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --port 8000 --workers 1 --no-access-log
```

Health: http://localhost:8000/healthz. OpenAPI: http://localhost:8000/docs. Neither dashboard rendering nor health requires a running database.

With Docker Compose installed, `docker compose up --build` runs the web app, one API worker, and Postgres. This configuration has not been exercised locally because Docker is unavailable in the current environment.

## Explore the preview

- View sample uptime, latency percentiles, traffic, vitals, and incidents.
- Change time ranges and percentiles, filter monitors, or inspect a monitor.
- Add a local monitor, reload to verify persistence, and delete it in monitor settings. Added monitors honestly remain **pending setup**.
- Use **Ctrl/⌘ K** or `/` to search; **G then D** opens the overview; `?` shows shortcuts.
- Switch between dark and light themes; update the local workspace name.
- Export explicitly labeled sample data as JSON and copy the sample status-page link.

Seeded demo monitors are read-only. There is no account registration, automatic beacon collection, or background website probing in this phase. The tracker snippet is an example only.

## Checks

```sh
cd web
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:smoke
```

```sh
cd backend
source .venv/bin/activate
ruff check .
pytest -q
alembic upgrade head --sql
```

The build enforces a 200 KiB gzip budget for initial JavaScript. Charts and secondary pages are lazy-loaded. CI also exercises online migrations against Postgres. Remote CI success is not claimed until this repository is pushed and the workflow runs.

See [DEPLOY.md](DEPLOY.md), [architecture](docs/ARCHITECTURE.md), [current verification](docs/PERFORMANCE.md), and [security scope](docs/SECURITY.md). Phase 1 starts only after review, as requested in the brief.
