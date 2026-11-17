"""Percentiles and time-weighted availability; unknown coverage is never downtime."""

from collections import Counter
from collections.abc import Iterable
from datetime import datetime, timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Check, Maintenance, MonitorGap, Rollup, RumEvent, Site, now

RANGES = {"1h": 3600, "24h": 86400, "7d": 604800, "30d": 2592000}


def percentiles(values: Iterable[float]) -> dict:
    """Return nulls for no observations, never manufactured zero latency."""
    data = list(values)
    if not data:
        return {"p50": None, "p95": None, "p99": None, "average": None, "apdex": None}
    return {
        "p50": round(float(np.percentile(data, 50)), 2),
        "p95": round(float(np.percentile(data, 95)), 2),
        "p99": round(float(np.percentile(data, 99)), 2),
        "average": round(float(np.mean(data)), 2),
        "apdex": round(
            sum(1 if v <= 500 else 0.5 if v <= 2000 else 0 for v in data) / len(data), 4
        ),
    }


def overlap_seconds(
    start: datetime, end: datetime, periods: list[tuple[datetime, datetime]]
) -> float:
    """Union overlaps before subtracting, so overlapping maintenance is not counted twice."""
    intervals = sorted((max(start, a), min(end, b)) for a, b in periods if a < end and b > start)
    total = 0.0
    cursor = start
    for a, b in intervals:
        a = max(a, cursor)
        if b > a:
            total += (b - a).total_seconds()
            cursor = b
    return total


def availability(
    checks: list,
    start: datetime,
    end: datetime,
    interval: int,
    excluded: list[tuple[datetime, datetime]],
) -> dict:
    """Credit only actually observed intervals, capped at the monitor cadence."""
    up = observed = 0.0
    ordered = sorted(checks, key=lambda check: check.ts)
    for i, check in enumerate(ordered):
        a = max(check.ts, start)
        b = min(
            end,
            check.ts + timedelta(seconds=interval),
            ordered[i + 1].ts if i + 1 < len(ordered) else end,
        )
        duration = max(0, (b - a).total_seconds() - overlap_seconds(a, b, excluded))
        if not check.maintenance:
            observed += duration
            up += duration if check.ok else 0
    eligible = max(0, (end - start).total_seconds() - overlap_seconds(start, end, excluded))
    return {
        "uptime": round(100 * up / observed, 4) if observed else None,
        "coverage": round(100 * observed / eligible, 2) if eligible else None,
        "observed_s": round(observed, 2),
        "up_s": round(up, 2),
        "excluded_s": round((end - start).total_seconds() - eligible, 2),
    }


def anomaly(values: list[float]) -> dict | None:
    """Require three robust outliers against a trailing baseline; no ML runtime."""
    if len(values) < 15:
        return None
    baseline = np.array(values[-63:-3])
    median = float(np.median(baseline))
    mad = max(float(np.median(np.abs(baseline - median))), 5.0)
    if all(0.6745 * (value - median) / mad > 3.5 for value in values[-3:]):
        increase = round((float(np.median(values[-3:])) / max(median, 1) - 1) * 100)
        return {
            "type": "latency",
            "message": (
                f"Response time is {increase}% higher than its recent baseline "
                "across three consecutive checks."
            ),
            "increase_percent": increase,
        }
    return None


async def summary(session: AsyncSession, site: Site, range_key: str, samples: bool = False) -> dict:
    """Combine retained hourly aggregates with nonoverlapping raw check coverage."""
    end = now()
    start = max(site.created_at, end - timedelta(seconds=RANGES.get(range_key, 86400)))
    raw_start = max(start, end - timedelta(days=7))
    raw = list(
        await session.scalars(
            select(Check)
            .where(
                Check.site_id == site.id, Check.ts >= raw_start - timedelta(seconds=site.interval_s)
            )
            .order_by(Check.ts)
        )
    )
    gaps = list(
        await session.scalars(
            select(MonitorGap).where(MonitorGap.ended_at > start, MonitorGap.started_at < end)
        )
    )
    windows = list(
        await session.scalars(
            select(Maintenance).where(
                Maintenance.site_id == site.id,
                Maintenance.ends_at > start,
                Maintenance.starts_at < end,
            )
        )
    )
    excluded = [(g.started_at, g.ended_at) for g in gaps] + [
        (w.starts_at, w.ends_at) for w in windows
    ]
    metrics = availability(raw, raw_start, end, site.interval_s, excluded)
    latencies = [check.total_ms for check in raw if check.ts >= raw_start and not check.maintenance]
    chart = [
        {
            "ts": c.ts.isoformat(),
            "total_ms": c.total_ms,
            "dns_ms": c.dns_ms,
            "tcp_ms": c.tcp_ms,
            "tls_ms": c.tls_ms,
            "ttfb_ms": c.ttfb_ms,
            "ok": c.ok,
        }
        for c in raw[-500:]
        if c.ts >= raw_start
    ]
    if start < raw_start:
        # Only whole buckets strictly before the raw boundary can be merged safely.
        older = list(
            await session.scalars(
                select(Rollup)
                .where(
                    Rollup.site_id == site.id,
                    Rollup.resolution == "hour",
                    Rollup.bucket >= start,
                    Rollup.bucket + timedelta(hours=1) <= raw_start,
                )
                .order_by(Rollup.bucket)
            )
        )
        for row in older:
            latencies.extend(row.data.get("latencies", []))
            metrics["observed_s"] += row.data.get("observed_s", 0)
            metrics["up_s"] += row.data.get("up_s", 0)
        if metrics["observed_s"]:
            metrics["uptime"] = round(100 * metrics["up_s"] / metrics["observed_s"], 4)
        eligible = (end - start).total_seconds() - overlap_seconds(start, end, excluded)
        metrics["coverage"] = (
            round(100 * metrics["observed_s"] / eligible, 2) if eligible > 0 else None
        )
    last = raw[-1] if raw else None
    last_good = next((c for c in reversed(raw) if c.ok), None)
    data = {
        **percentiles(latencies),
        **metrics,
        "count": len(latencies),
        "range": range_key,
        "chart": chart,
        "gaps": [
            {
                "started_at": g.started_at.isoformat(),
                "ended_at": g.ended_at.isoformat(),
                "reason": g.reason,
            }
            for g in gaps
        ],
        "last_checked_at": site.last_checked_at,
        "last_success_at": last_good.ts if last_good else None,
        "stale": not site.last_checked_at
        or (end - site.last_checked_at).total_seconds() > site.interval_s * 2,
        "tls_days_left": last.tls_days_left if last else None,
        "insight": anomaly([c.total_ms for c in raw[-63:]]),
        "history_limited": start < raw_start,
        "maintenance": any(w.starts_at <= end < w.ends_at for w in windows),
    }
    if samples:
        data["_samples"] = latencies
    return data


def traffic_metrics(events: list[RumEvent]) -> dict:
    """Aggregate bounded path/referrer/device dimensions with explicit vitals bands."""
    views = [event for event in events if event.event_type == "pageview"]

    def ranked(counter: Counter, limit: int = 20) -> list[dict]:
        return [{"name": name, "count": count} for name, count in counter.most_common(limit)]

    latest_vitals = {}
    for event in sorted(events, key=lambda event: event.ts):
        if event.event_type == "vitals":
            latest_vitals[
                (event.session_hash, event.path, event.timings.get("_view", "legacy"))
            ] = event
    vitals = {}
    for key, good, poor in [("lcp_ms", 2500, 4000), ("inp_ms", 200, 500), ("cls", 0.1, 0.25)]:
        values = [event.timings[key] for event in latest_vitals.values() if key in event.timings]
        value = round(float(np.percentile(values, 75)), 3) if values else None
        vitals[key] = {
            "p75": value,
            "band": "unknown"
            if value is None
            else "good"
            if value <= good
            else "poor"
            if value > poor
            else "needs-improvement",
        }
    return {
        "page_views": len(views),
        "unique_visitors": len({event.visitor_hash for event in views}),
        "top_pages": ranked(Counter(event.path for event in views)),
        "referrers": ranked(Counter(event.referrer_host or "Direct" for event in views)),
        "devices": ranked(Counter(event.device for event in views)),
        "timezones": ranked(Counter(event.tz or "Unknown" for event in views)),
        "vitals": vitals,
    }


async def traffic(session: AsyncSession, site_id: str, range_key: str) -> dict:
    """Raw traffic is bounded to 48h; older traffic uses explicitly approximate rollups."""
    end = now()
    start = end - timedelta(seconds=RANGES.get(range_key, 86400))
    raw_start = max(start, end - timedelta(hours=48))
    events = list(
        await session.scalars(
            select(RumEvent)
            .where(RumEvent.site_id == site_id, RumEvent.ts >= raw_start)
            .limit(200000)
        )
    )
    data = traffic_metrics(events)
    if start < raw_start:
        old = list(
            await session.scalars(
                select(Rollup).where(
                    Rollup.site_id == site_id,
                    Rollup.resolution == "hour",
                    Rollup.bucket >= start,
                    Rollup.bucket + timedelta(hours=1) <= raw_start,
                )
            )
        )
        for row in old:
            data["page_views"] += row.data.get("traffic", {}).get("page_views", 0)
            data["unique_visitors"] += row.data.get("traffic", {}).get("unique_visitors", 0)
        for dimension in ["top_pages", "referrers", "devices", "timezones"]:
            counter = Counter({item["name"]: item["count"] for item in data[dimension]})
            for row in old:
                counter.update(
                    {
                        item["name"]: item["count"]
                        for item in row.data.get("traffic", {}).get(dimension, [])
                    }
                )
            data[dimension] = [
                {"name": name, "count": count} for name, count in counter.most_common(20)
            ]
    return {
        **data,
        "range": range_key,
        "unique_visitors_approximate": start < raw_start,
        "vitals_window": "last 48 hours" if start < raw_start else range_key,
    }
