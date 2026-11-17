"""Idempotent rollups and conservative retention with a durable hourly watermark."""

from datetime import datetime, timedelta

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import session_factory
from app.models import (
    AlertLog,
    Check,
    Deployment,
    Incident,
    Maintenance,
    MonitorGap,
    Rollup,
    RumEvent,
    ServiceState,
    Site,
    now,
)
from app.services.analytics import availability, percentiles, traffic_metrics


async def build_bucket(
    session: AsyncSession, site: Site, bucket: datetime, resolution: str
) -> None:
    """Replace a closed bucket atomically so rerunning cron cannot duplicate counts."""
    end = bucket + timedelta(minutes=1 if resolution == "minute" else 60)
    checks = list(
        await session.scalars(
            select(Check)
            .where(
                Check.site_id == site.id,
                Check.ts >= bucket - timedelta(seconds=site.interval_s),
                Check.ts < end,
            )
            .order_by(Check.ts)
        )
    )
    events = list(
        await session.scalars(
            select(RumEvent).where(
                RumEvent.site_id == site.id, RumEvent.ts >= bucket, RumEvent.ts < end
            )
        )
    )
    gaps = list(
        await session.scalars(
            select(MonitorGap).where(MonitorGap.ended_at > bucket, MonitorGap.started_at < end)
        )
    )
    windows = list(
        await session.scalars(
            select(Maintenance).where(
                Maintenance.site_id == site.id,
                Maintenance.ends_at > bucket,
                Maintenance.starts_at < end,
            )
        )
    )
    periods = [(g.started_at, g.ended_at) for g in gaps] + [
        (w.starts_at, w.ends_at) for w in windows
    ]
    latencies = [c.total_ms for c in checks if c.ts >= bucket and not c.maintenance]
    traffic = traffic_metrics(events) if events else {}
    # Bound retained JSON cardinality and label length; keep omitted counts in Other.
    for name in ["top_pages", "referrers", "timezones"]:
        keep, width = (2, 32) if resolution == "minute" else (4, 64)
        rows = traffic.get(name, [])
        traffic[name] = [
            {
                "name": row["name"].encode("utf-8")[:width].decode("utf-8", "ignore"),
                "count": row["count"],
            }
            for row in rows[:keep]
        ]
        other = traffic.get("page_views", 0) - sum(row["count"] for row in rows[:keep])
        if other:
            traffic[name].append({"name": "Other", "count": other})
    if not events:
        traffic = {}
    data = {
        **availability(checks, bucket, end, site.interval_s, periods),
        **percentiles(latencies),
        "latencies": latencies[:720],
        "traffic": traffic,
    }
    await session.execute(
        delete(Rollup).where(
            Rollup.site_id == site.id, Rollup.bucket == bucket, Rollup.resolution == resolution
        )
    )
    session.add(Rollup(site_id=site.id, bucket=bucket, resolution=resolution, data=data))


async def maintain() -> None:
    """Catch up at most 24 hours per tick, then enforce raw TTL and bounded history."""
    current = now()
    hour = current.replace(minute=0, second=0, microsecond=0)
    minute = current.replace(second=0, microsecond=0)
    async with session_factory()() as session:
        sites = list(await session.scalars(select(Site)))
        for site in sites:
            key = f"rollup:{site.id}"
            state = await session.get(ServiceState, key)
            cursor = (
                datetime.fromisoformat(state.value)
                if state
                else max(
                    site.created_at.replace(minute=0, second=0, microsecond=0),
                    hour - timedelta(days=7),
                )
            )
            for _ in range(24):
                if cursor >= hour:
                    break
                await build_bucket(session, site, cursor, "hour")
                cursor += timedelta(hours=1)
            if state:
                state.value = cursor.isoformat()
            else:
                session.add(ServiceState(key=key, value=cursor.isoformat()))
            for delta in [1, 2]:
                bucket = minute - timedelta(minutes=delta)
                if bucket >= site.created_at.replace(second=0, microsecond=0):
                    await build_bucket(session, site, bucket, "minute")
            await session.execute(
                delete(Check).where(
                    Check.site_id == site.id, Check.ts < current - timedelta(days=7)
                )
            )
            await session.execute(
                delete(RumEvent).where(
                    RumEvent.site_id == site.id,
                    RumEvent.ts < current - timedelta(hours=48),
                )
            )
        await session.execute(
            delete(Rollup).where(
                Rollup.resolution == "minute", Rollup.bucket < current - timedelta(days=7)
            )
        )
        await session.execute(
            delete(Rollup).where(
                Rollup.resolution == "hour", Rollup.bucket < current - timedelta(days=90)
            )
        )
        await session.execute(
            delete(Incident).where(Incident.resolved_at < current - timedelta(days=90))
        )
        await session.execute(
            delete(MonitorGap).where(MonitorGap.ended_at < current - timedelta(days=90))
        )
        for model, timestamp in [
            (AlertLog, AlertLog.ts),
            (Deployment, Deployment.ts),
            (Maintenance, Maintenance.ends_at),
        ]:
            await session.execute(delete(model).where(timestamp < current - timedelta(days=90)))
        for site in sites:
            for model, timestamp, limit in [
                (Incident, Incident.started_at, 100),
                (AlertLog, AlertLog.ts, 1000),
                (Deployment, Deployment.ts, 100),
                (Maintenance, Maintenance.starts_at, 100),
            ]:
                old = (
                    select(model.id)
                    .where(model.site_id == site.id)
                    .order_by(timestamp.desc())
                    .offset(limit)
                )
                if model is Incident:
                    old = old.where(Incident.resolved_at.is_not(None))
                await session.execute(delete(model).where(model.id.in_(old)))
        pressure = await session.get(ServiceState, "storage_pressure")
        full = str(
            int(
                await session.scalar(text("SELECT pg_database_size(current_database())"))
                > 400 * 1024 * 1024
            )
        )
        if pressure:
            pressure.value = full
        else:
            session.add(ServiceState(key="storage_pressure", value=full))
        await session.commit()
