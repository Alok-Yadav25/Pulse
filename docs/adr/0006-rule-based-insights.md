# ADR 0006: MAD insights and rule-based profiles

Status: accepted and implemented.

Latency anomalies compare a recent window with an older baseline using median and median absolute deviation. Three consecutive outliers are required, with an absolute floor when the baseline MAD is zero. This limits noise and avoids a trained model or heavyweight runtime dependency. It is a heuristic, not an incident diagnosis; the incident confirmation state machine remains separate.

Homepage profiles inspect bounded public HTML, metadata, known stack signatures and header presence through the same SSRF-safe transport. Category and summary come from local rules and are labeled accordingly. The optional LLM setting does not trigger an external request. Header presence is a limited checklist rather than a security audit. Profiles are cached and refresh is limited to once per day.
