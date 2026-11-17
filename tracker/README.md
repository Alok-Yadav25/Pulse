# Pulse tracker

`pulse.js` is dependency-free source. `node tracker/build.mjs` uses the web workspace's esbuild to write `backend/app/static/t.js` and fails above **2 KiB gzip**. `npm run build` in `web` also builds and checks it. The current payload is **1,284 bytes gzip**.

Copy the script tag from a live monitor's Settings. Its `data-key` identifies that monitor and its source points at the API's `/t.js?v=1`. API URL and site Origin must match the installation. The key is public; it is not an authentication credential. The API checks exact Origin, payload size, rate and daily budgets. Origin checks are an abuse barrier, not proof that a non-browser sender owns a site.

The tracker strips query strings, sends referrer host only, uses sessionStorage with an in-memory fallback, and sets no cookies. Do Not Track exits before storage or network activity. SPA pushState and popstate transitions record pageviews. Visible pages send a heartbeat every 30 seconds. Navigation Timing and supported LCP/CLS/interaction observers collect real measurements; unsupported values remain absent. INP is a bounded estimate over at most 500 observed interactions, not a full web-vitals library implementation.

Events batch through sendBeacon with a keepalive fetch fallback. A failed beacon is not durably retried. A 202 response means queued, not yet persisted. The dashboard's install panel changes from waiting to verified after the first committed beacon.

The real browser integration test verifies ingestion, stripped paths, SPA pageviews, and DNT. Storage-disabled fallback and input sanitization are also covered by implementation boundaries and backend tests; no cross-browser compatibility claim is made beyond the tested Chromium run.
