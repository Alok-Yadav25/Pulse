# Security and privacy

## Implemented boundaries

- SSRF: HTTP(S) only; ports 80/443/8080/8443; no credentials, escaped hosts, control characters, or backslashes. All DNS answers must be public unicast. Private, loopback, link-local/metadata, CGNAT, mapped private IPv4, transition IPv6, NAT64, multicast, reserved, decimal/octal/hex tricks, and Pulse's configured domains are rejected. Connections use validated IPs, retain Host/SNI, and validate redirects again.
- Authentication: Argon2 with a bounded 19 MiB working set and at most two concurrent hash operations; issuer/audience-bound HS256 JWTs; explicit expiry; ownership checked on every site and subordinate route; read-only demo accounts.
- Requests: bounded 4 KiB beacon bodies and 16 KiB other write bodies, including chunked transport; Pydantic input limits; parameterized SQLAlchemy queries; explicit dashboard CORS origins; security headers; bounded rate-limit key storage and auth/ingest/write limits.
- Alerts: HTTPS destinations only, the same public-network transport and DNS checks, no webhook redirect following, no webhook target secrets in API responses, grouping by incident/threshold, cooldown deferral, at most three delivery attempts.
- Visitors: no cookies or persistent visitor ID. DNT disables the tracker before storage or network activity. The server retains rotating HMAC hashes, not raw IPs or user agents. Hash secrets require at least 32 characters. Page queries/fragments and referrer paths are stripped. Timezone/device data is bounded.
- Limits: 10 real sites and 10 accounts by default, 5,000 events per site per UTC day, 50 live connections, 1,000 buffered events, 5,000 ephemeral active identities per site. Database pressure above 400 MiB pauses analytics ingestion at the next maintenance check.
- Deletion: site deletion cascades through checks, events, incidents, profiles, releases, maintenance, and alert history, and removes pending buffered beacons and ephemeral counters for that site.

Uvicorn access logs are disabled by the supplied commands. Logs identify background failure classes without printing visitor identities or webhook targets. Hosting providers can have their own infrastructure logs.

Secrets remain in environment configuration and ignored local `.env` files. Browser tokens and live snapshots use sessionStorage and are cleared on sign-out. Display preferences and the explicitly labeled sample workspace use localStorage. Storage failures do not crash rendering.

## Verification and remaining limits

Automated tests cover adversarial URL forms, DNS answer mixing, redirect revalidation, pinned Host/SNI with a real TLS test server, password verification, authorization isolation, body limits, Origin validation, hash-only storage, retention/rollups, alert grouping/cooldowns, and pending-beacon deletion. Browser tests execute the actual tracker, SPA tracking, and DNT behavior. Automated WCAG checks cover the landing and dashboard in desktop/mobile layouts.

This is not a third-party penetration test or a claim of complete WCAG conformance. The public tracker key and Origin header are not authentication against arbitrary non-browser clients; quotas/rate limits bound abuse. JWT sessions have no refresh-token/revocation service. Accepted buffered beacons can be lost on restart. INP uses a bounded approximation. These are explicit single-process MVP tradeoffs.
