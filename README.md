<div align="center">
  <img src="web/public/brand/pulse-logo.svg" alt="Pulse" width="220" />
  <h1>Stay ahead. Stay in pulse.</h1>
  <p>Website uptime, performance, and visitor analytics.<br />Every signal. One extraordinary view.</p>
  <p>
    <a href="https://github.com/Alok-Yadav25/Pulse/actions/workflows/ci.yml"><img src="https://github.com/Alok-Yadav25/Pulse/actions/workflows/ci.yml/badge.svg" alt="Pulse checks" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-cbb8ff?style=flat-square" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square" alt="React 18" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/Python-3.12-ffd343?style=flat-square" alt="Python 3.12" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square" alt="FastAPI" />
  </p>
  <p>
    <a href="#preview">Preview</a> ·
    <a href="#features">Features</a> ·
    <a href="#tech-stack">Tech stack</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#how-pulse-works">Workflow</a> ·
    <a href="#development--checks">Development</a>
  </p>
</div>

![Pulse landing page with a violet orbital hero, pink typography, and lime accents](docs/previews/landing-hero.png)

## Meet Pulse

Pulse brings website health and audience activity into one responsive workspace. Monitor public URLs, inspect response timings, follow incidents, and understand visitors through layered charts and focused summaries.

The interface combines midnight and daylight themes, self-hosted Sora and Manrope fonts, interactive SVG charts, and motion that respects reduced-motion preferences. The app runs locally with React, FastAPI, and PostgreSQL.

## Preview

### The signal studio

Uptime, latency, coverage, and incidents in a single overview. The screenshot below uses clearly labeled sample data.

![Pulse dark dashboard showing layered request timings, health rings, monitors, and incidents](docs/previews/dashboard-dark.png)

<table>
  <tr>
    <th>Daylight theme</th>
    <th>Visitor analytics</th>
  </tr>
  <tr>
    <td><a href="docs/previews/dashboard-light.png"><img src="docs/previews/dashboard-light.png" alt="Pulse dashboard in the light theme" width="640" /></a></td>
    <td><a href="docs/previews/traffic.png"><img src="docs/previews/traffic.png" alt="Traffic dashboard with top pages, referrers, audience rings, and Web Vitals" width="640" /></a></td>
  </tr>
</table>

<details>
  <summary><strong>Explore mobile layouts and the public status page</strong></summary>

  <p>Responsive layouts keep the same monitoring tools available on smaller screens.</p>
  <p align="center">
    <a href="docs/previews/landing-mobile.png"><img src="docs/previews/landing-mobile.png" alt="Pulse mobile landing page" width="240" /></a>
    <a href="docs/previews/dashboard-mobile.png"><img src="docs/previews/dashboard-mobile.png" alt="Pulse mobile dashboard" width="240" /></a>
  </p>
  <p>Public status pages share opted-in monitor health and incident history.</p>
  <img src="docs/previews/status.png" alt="Pulse public status page" width="100%" />
</details>

All screenshots come from local Chromium browser runs. Dashboard and traffic values shown here are illustrative sample data.

## Features

| Capability | What you get |
| --- | --- |
| **Website monitoring** | Scheduled public-URL checks, full path and query preservation, response assertions, and TLS certificate expiry. |
| **Performance visibility** | DNS, TCP, TLS, TTFB, and total response timings; p50/p95/p99, coverage, and interactive phase breakdowns. |
| **Incident management** | Confirmed failures, recovery tracking, maintenance windows, release markers, and incident reports. |
| **Visitor analytics** | Page views, active visitors, top pages, referrer hosts, device breakdowns, timezones, and supported browser vitals. |
| **Live updates** | Authenticated Server-Sent Events with reconnect behavior and REST polling fallback. |
| **Alerts** | Grouped Slack, Discord, Telegram, and generic HTTPS webhook notifications with cooldowns and retries. |
| **Public communication** | Opt-in status pages and embeddable SVG status badges. |
| **Focused interface** | Dark/light themes, responsive navigation, command search, keyboard chart controls, accessible data tables, and reduced-motion support. |
| **Privacy controls** | Cookie-free tracker, Do Not Track support, stripped query strings, and no raw IP or user-agent storage. |
| **Local ownership** | Native local PostgreSQL, persistent development data, migrations, and an API explorer. |

## Tech stack

| Layer | Technologies | Role |
| --- | --- | --- |
| **Frontend** | React 18, TypeScript 5, Vite 6, React Router | Application, routing, and build tooling. |
| **UI & motion** | Tailwind CSS, Radix UI, Framer Motion, Lucide, cmdk | Styling, dialogs, animation, icons, and command search. |
| **Data & charts** | TanStack Query, native SVG | Server state, cache updates, layered charts, rings, and sparklines. |
| **Typography** | Sora, Manrope, JetBrains Mono | Self-hosted display, interface, and technical fonts. |
| **Backend** | Python 3.12, FastAPI, Uvicorn, Pydantic | Async API, validation, and configuration. |
| **Database** | PostgreSQL, SQLAlchemy 2, asyncpg, Alembic | Persistent storage, async queries, and schema migrations. |
| **Monitoring** | APScheduler, asyncio, h11, certifi | Scheduling, timed HTTP probes, and verified HTTPS connections. |
| **Authentication** | Argon2, PyJWT | Password hashing and bearer-token authentication. |
| **Tracker** | Dependency-free JavaScript, Beacon API, Performance APIs | Batched visitor events and browser performance measurements. |
| **Quality** | Vitest, Playwright, axe, Lighthouse CI, pytest, Ruff, ESLint | Unit, integration, browser, accessibility, and performance checks. |
| **Automation** | GitHub Actions | Frontend/backend checks, migrations, browser tests, and build budgets. |

## Quick start

Install **Python 3.12** and **Node.js 22** with npm, then run:

```sh
git clone https://github.com/Alok-Yadav25/Pulse.git
cd Pulse
python3.12 scripts/dev.py
```

The helper creates the Python environment, installs missing dependencies, starts native PostgreSQL, applies migrations, and launches one API worker plus Vite. The first run needs internet access to download dependencies.

| Service | Local address |
| --- | --- |
| Landing page | http://localhost:5173 |
| Dashboard | http://localhost:5173/dashboard |
| Interactive API docs | http://localhost:8000/docs |
| Liveness / readiness | http://localhost:8000/healthz · http://localhost:8000/readyz |

Database files persist in `.local/postgres`; development secrets stay in ignored `backend/.env` configuration. Press **Ctrl+C** to stop the helper's services. If `python3` already points to Python 3.12, `npm run dev:all` is an alternative entry point.

### Connect your first monitor

1. Open the dashboard and choose **Enable live monitoring → Create account**.
2. Add a public HTTP(S) URL, including any endpoint path and query you need checked.
3. Open the monitor to inspect checks, timings, and incident history.
4. Use its settings to configure assertions, tags, alert channels, public status, maintenance, or release markers.
5. For visitor analytics, copy the tracker snippet from the monitor's settings into a website you control.

**Sample and live workspaces have different behavior:** sample mode works without an API and stores sample monitors in your browser. It does not run network checks. Live mode saves monitors to PostgreSQL and schedules real probes.

You can check the public availability, response timing, and TLS of sites such as YouTube or Spotify from a live workspace. Their visitor analytics and browser vitals require access to install the tracker; adding a URL alone cannot collect them.

### Install the visitor tracker

Use the exact snippet generated by your live monitor. For the default local API, it looks like:

```html
<script
  defer
  src="http://localhost:8000/t.js?v=1"
  data-key="YOUR_SITE_KEY"
></script>
```

The site key is a public monitor identifier. The tracker script and ingestion API must be reachable from the visitor's browser, and the page's Origin must match the configured monitor. The local address above works for local development; a hosted site needs a reachable HTTPS API. See the [tracker guide](tracker/README.md) for event behavior and measurement limits.

## How Pulse works

```mermaid
flowchart TD
    Dashboard["React workspace"] -->|"Bearer-authenticated REST"| API["FastAPI · one worker"]
    API -->|"SSE updates"| Dashboard
    API -->|"Configure monitors"| Scheduler["APScheduler"]
    Scheduler --> Probe["Validate DNS · pin public IP · verify TLS"]
    Probe -->|"HTTP checks"| Site["Public website or API"]
    Site -->|"Status · timings · assertions"| Incidents["Incident and recovery rules"]
    Incidents -->|"Persist observations"| DB[("PostgreSQL")]
    Incidents --> Alerts["Grouped alert outbox"]
    Alerts --> Channels["Slack · Discord · Telegram · Webhooks"]
    Visitors["Browser on a tracker-enabled site"] -->|"Page views · heartbeats · vitals"| Ingest["Origin and quota validation · batched ingestion"]
    Ingest --> DB
    DB --> Analytics["Analytics · rollups · retention"]
    Analytics --> API
    API --> Public["Public status pages and badges"]
```

**Monitoring workflow:** save a URL → validate its public destination → run a timed probe → store the result → update the workspace. Three consecutive failed checks open an incident; two consecutive successes close it. Confirmation retries are five seconds apart. Maintenance windows continue checks while suppressing new incident transitions and alerts.

**Analytics workflow:** install the tracker → collect supported browser events → validate Origin and quotas → batch writes → aggregate page views, audience dimensions, and performance data. Active visitor counts are ephemeral; historical observations and rollups live in PostgreSQL.

**Try the incident lifecycle:** choose **Connect live → Try the live chaos demo**, then **Break it**. This starts a bounded 45-second failure against a controlled target so you can observe incident confirmation and recovery.

## Project structure

```text
Pulse/
├── web/                    React app, UI components, charts, and browser tests
│   ├── src/                Routes, components, state, and styles
│   └── public/brand/       Pulse logo and brand assets
├── backend/
│   ├── app/                API routers, models, scheduler, and services
│   ├── alembic/            Database migrations
│   └── tests/              Unit and PostgreSQL integration tests
├── tracker/                Browser tracker source and build script
├── scripts/dev.py          Local service bootstrap and lifecycle
├── docs/                   Architecture, security, metrics, and screenshots
├── loadtest/               Local ingestion diagnostics
└── .github/workflows/      Automated checks
```

## Development & checks

Run these commands from the repository root after local setup:

```sh
npm run check                # TypeScript and ESLint
npm test                     # Frontend unit tests
npm run build                # Production build, tracker build, and size budgets
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest -q backend/tests
```

Backend integration tests require `TEST_DATABASE_URL` pointing to a **disposable PostgreSQL database**; they reset its schema. Without it, integration tests skip. For a dedicated test database:

```sh
TEST_DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@localhost:5432/pulse_test' \
  backend/.venv/bin/pytest -q backend/tests
```

Browser tests use the production build, Chromium, and a running migrated API/database:

```sh
npm --prefix web exec -- playwright install chromium
npm run test:smoke
npm --prefix web run test:lighthouse
```

For isolated browser tests, set `BROWSER_DATABASE_URL` to a migrated disposable database and stop any API already using port 8000. The runner can reuse an existing local API; live tests create test accounts and monitors. Set `CHROME_PATH` if Lighthouse cannot discover Chrome/Chromium. GitHub Actions provisions separate PostgreSQL services and runs migration upgrade/downgrade/upgrade checks.

### Performance budgets

The production build enforces **200 KiB gzip across all JavaScript chunks** and **2 KiB gzip for the tracker**. Routes and charts load separately, fonts are self-hosted, and charts use native SVG. Recorded local Lighthouse runs scored **99 for performance** and **100 for accessibility**; these describe the documented local build, not a hosted deployment. See [performance evidence and reproduction steps](docs/PERFORMANCE.md).

## Operating scope

The default setup uses one API process, with limits of 10 real monitors, 10 accounts, 50 SSE clients, and 5,000 accepted tracker events per site per UTC day. Probes run from a single location. The two-second event buffer and live visitor counters are in memory; accepted but unflushed events can be lost on a crash.

Uptime calculations account for observed coverage and maintenance. Older unique-visitor aggregates are approximate, and tracker INP is a bounded estimate. Site insights use local rules. Docker Compose and Render/Cloudflare deployment configuration are included; Docker execution and cloud deployment have not been verified in this workspace.

## Documentation

| Guide | Contents |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Service boundaries, probes, ingestion, live updates, and analytics. |
| [Security](docs/SECURITY.md) | URL validation, SSRF defenses, authentication, and privacy boundaries. |
| [Storage](docs/STORAGE.md) | Retention, rollups, quotas, and storage safeguards. |
| [Performance](docs/PERFORMANCE.md) | Recorded local results, bundle budgets, and reproduction steps. |
| [Tracker](tracker/README.md) | Installation, events, privacy behavior, and browser measurement limits. |
| [Deployment](DEPLOY.md) | Local configuration and optional future hosting. |
| [Design decisions](docs/adr/) | Architecture and interface decision records. |

## License & author

Released under the [MIT License](LICENSE).

Made by **[Alok Yadav](https://github.com/Alok-Yadav25)**.
