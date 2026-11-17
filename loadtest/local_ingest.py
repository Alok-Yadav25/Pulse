"""Measure local diagnostic beacon bursts without claiming production capacity.

Run with backend/.venv/bin/python loadtest/local_ingest.py --rates 1 2 4 --seconds 10.
Only loopback targets are accepted; generated accounts are disposable local test data.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import platform
import secrets
import statistics
import time
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import psutil


async def measure(args) -> None:
    if urlsplit(args.base_url).hostname not in {"127.0.0.1", "localhost"}:
        raise SystemExit(
            "This diagnostic harness is local-only. "
            "Use an explicit deployment harness for hosted testing."
        )
    email = f"load-{secrets.token_hex(5)}@example.com"
    results = []
    samples = []
    sampler = None
    if args.pid:
        process = psutil.Process(args.pid)

        async def sample():
            while True:
                samples.append(process.memory_info().rss)
                await asyncio.sleep(0.5)

        sampler = asyncio.create_task(sample())
    try:
        async with httpx.AsyncClient(base_url=args.base_url, timeout=15) as client:
            auth = await client.post(
                "/api/auth/register",
                json={"email": email, "password": secrets.token_urlsafe(24)},
            )
            auth.raise_for_status()
            headers = {"Authorization": "Bearer " + auth.json()["access_token"]}
            created = await client.post(
                "/api/sites",
                headers=headers,
                json={
                    "name": "Disposable local ingest benchmark",
                    "url": "https://example.com/benchmark",
                },
            )
            created.raise_for_status()
            site = created.json()
            try:
                for rate in args.rates:
                    latencies = []
                    codes = {}
                    accepted = 0
                    started = time.perf_counter()

                    async def send(index, latencies=latencies, codes=codes):
                        nonlocal accepted
                        session = f"benchmark-{index}-{secrets.token_hex(8)}"
                        payload = {
                            "key": site["site_key"],
                            "events": [
                                {
                                    "event_type": "pageview",
                                    "session": session,
                                    "path": "/benchmark",
                                    "device": "desktop",
                                    "tz": "UTC",
                                },
                                {
                                    "event_type": "vitals",
                                    "session": session,
                                    "view": session,
                                    "path": "/benchmark",
                                    "timings": {
                                        "lcp_ms": 1200,
                                        "inp_ms": 140,
                                        "cls": 0.02,
                                    },
                                },
                                {
                                    "event_type": "heartbeat",
                                    "session": session,
                                    "path": "/benchmark",
                                },
                            ],
                        }
                        stamp = time.perf_counter()
                        response = await client.post(
                            "/ingest",
                            content=json.dumps(payload),
                            headers={
                                "Origin": "https://example.com",
                                "Content-Type": "text/plain",
                            },
                        )
                        latencies.append((time.perf_counter() - stamp) * 1000)
                        codes[str(response.status_code)] = (
                            codes.get(str(response.status_code), 0) + 1
                        )
                        if response.status_code == 202:
                            accepted += 3

                    tasks = []
                    for index in range(rate * args.seconds):
                        await asyncio.sleep(
                            max(0, started + index / rate - time.perf_counter())
                        )
                        tasks.append(asyncio.create_task(send(index)))
                    await asyncio.gather(*tasks)
                    await asyncio.sleep(
                        max(0, started + args.seconds - time.perf_counter())
                    )
                    elapsed = time.perf_counter() - started
                    ordered = sorted(latencies)
                    results.append(
                        {
                            "target_requests_per_second": rate,
                            "duration_s": round(elapsed, 3),
                            "requests": len(tasks),
                            "accepted_events": accepted,
                            "accepted_events_per_second": round(accepted / elapsed, 2),
                            "p50_ms": round(statistics.median(latencies), 2),
                            "p95_ms": round(
                                ordered[max(0, int(len(ordered) * 0.95) - 1)], 2
                            ),
                            "status_codes": codes,
                        }
                    )
            finally:
                await asyncio.sleep(2.5)
                response = await client.delete(
                    "/api/sites/" + site["id"], headers=headers
                )
                response.raise_for_status()
    finally:
        if sampler:
            sampler.cancel()
    data = {
        "environment": platform.system() + " " + platform.machine(),
        "scope": (
            "Local diagnostic bursts; not a sustainable-capacity or Render free-tier benchmark"
        ),
        "events_per_request": 3,
        "runs": results,
        "api_peak_rss_mib": round(max(samples) / 1048576, 2) if samples else None,
        "api_start_rss_mib": round(samples[0] / 1048576, 2) if samples else None,
    }
    await asyncio.to_thread(Path(args.output).write_text, json.dumps(data, indent=2) + "\n")
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--rates", nargs="+", type=int, default=[1, 2, 4])
    parser.add_argument("--seconds", type=int, default=10)
    parser.add_argument("--pid", type=int)
    parser.add_argument("--output", default="docs/local-load-results.json")
    arguments = parser.parse_args()
    if not 1 <= arguments.seconds <= 60 or any(
        rate > 20 or rate < 1 for rate in arguments.rates
    ):
        raise SystemExit(
            "Local harness is capped at 60-second runs and 20 requests/second."
        )
    asyncio.run(measure(arguments))
