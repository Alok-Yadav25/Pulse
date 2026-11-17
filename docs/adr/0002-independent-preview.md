# ADR 0002: an independent, clearly labeled preview

Status: accepted for phase 0 design review.

The UI must load immediately even when a free API service is asleep. Phase 0 renders deterministic sample data directly in the frontend. Every analytics screen and status preview labels its data as illustrative. Added monitors remain pending and are stored only in this browser. No simulated live updates or random uptime claims are emitted.

This allows review of the product direction while the security boundary and probe implementation are built in later phases. It does not demonstrate live monitoring. Future API hooks must use cached snapshots and an explicit waking state; they must not silently fall back to samples after a network error.
