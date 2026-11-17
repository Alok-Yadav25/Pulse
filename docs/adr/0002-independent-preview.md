# ADR 0002: explicit sample and live workspaces

Status: accepted and implemented.

The static introduction and sample workspace render without waiting for an API. Deterministic per-site samples are visibly labeled. Browser-local sample monitors preserve the complete URL and remain pending; they never issue a probe.

Live authentication selects owner-scoped server queries and session cache. Loading, waking, stale snapshot and error states are explicit. A live request failure never substitutes sample analytics. Logging out clears private query/cache state. The reserved /status/acme page remains illustrative regardless of the current live account. Real public status pages expose only opted-in monitor data.
