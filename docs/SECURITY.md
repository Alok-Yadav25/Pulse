# Security and privacy scope

Phase 0 has no authentication, ingestion, probing, profiling, cron, or user database writes. Health and metadata are public. The API uses an exact CORS origin allowlist and response security headers. `/healthz` does not create a database pool. Uvicorn access logging is disabled in the supplied run/deploy commands to avoid logging visitor addresses at the application layer. Hosting providers can maintain their own infrastructure logs.

Secrets are environment-only and excluded from Git. No key is needed to render the preview. Frontend URL validation is convenience validation only; it is **not** an SSRF boundary. Added monitors are stored locally and are never fetched or probed. The server-side URL validator, DNS/IP pinning, redirect checks, and at least 30 adversarial test cases must ship before phase 1 enables any network requests.

Local preferences and monitor hostnames can be cleared in browser storage. The planned tracker will respect Do Not Track, use no cookies or persistent visitor identifier, strip query strings and referrer paths, and retain only rotating hashes of request-derived visitor identity. These tracker guarantees are design requirements, not implemented capabilities.

Password hashing, JWT, per-user quotas, Origin validation, request rate limits, payload caps, deletion cascades, and webhook destination validation are later-phase work. No production security review has been completed.
