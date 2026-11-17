# Local ingestion diagnostic

Run the local app, then from the repository root:

```sh
backend/.venv/bin/python loadtest/local_ingest.py --rates 1 2 4 --seconds 10 --pid <API_PID>
```

The harness is deliberately restricted to loopback, at most 20 requests/second and 60 seconds per stage. Each request contains a pageview, vitals event and heartbeat. It reports accepted events/second, response codes, client p50/p95 and optional sampled API RSS. It creates a test account, deletes its monitor and events after a flush allowance, and leaves that account locally. Repeated runs can consume the default ten-account allowance; use a disposable test database.

Results are written to `docs/local-load-results.json`. [PERFORMANCE.md](../docs/PERFORMANCE.md) records the actual environment and limits of the measurement. These short bursts are not a production load test. No deployed sustainable events/second measurement exists because the project is being kept local.
