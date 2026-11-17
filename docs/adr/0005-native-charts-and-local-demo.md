# ADR 0005: native SVG charts and explicit data modes

Status: accepted and implemented.

Recharts added roughly 120 KiB gzip to dashboard startup. The requested plots are small time series, gap bands, phase lines, and release markers, so native SVG provides the needed interactions with a roughly 2 KiB chart chunk. Arrow-key inspection and an alternate data table support accessibility. The build budgets every JavaScript chunk together, rather than only the entry point.

Sample mode is a separate, labeled data source with per-monitor populations and derived statistics. Live mode uses owned API data and owner-scoped session snapshots. It never silently substitutes samples after a network error. The chaos demo is a read-only seeded account with a bounded, controlled internal target; it does not bypass SSRF protection for user-provided URLs.
