"""Validated beacon ingestion, bounded batching, and ephemeral live counters."""

import asyncio
import time
from collections import defaultdict
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy import insert, select

from app.config import get_settings
from app.db import session_factory
from app.models import RumEvent, ServiceState, Site, identity, now
from app.schemas import BeaconInput
from app.services.broker import broker
from app.services.security import private_hash

buffer: list[dict] = []
buffer_lock = asyncio.Lock()
active: dict[str, dict[str, float]] = defaultdict(dict)


def active_visitors(site_id: str) -> int:
    """Count identities seen within 60 seconds; prune old entries on every read."""
    current = time.monotonic()
    visitors = active[site_id]
    for key, stamp in list(visitors.items()):
        if current - stamp > 60:
            visitors.pop(key)
    return len(visitors)


async def flush() -> None:
    """Commit one batch; keep data buffered if Postgres is temporarily unavailable."""
    async with buffer_lock:
        if not buffer:
            return
        async with session_factory()() as session:
            rows = buffer[:1000]
            await session.execute(insert(RumEvent), rows)
            owners = list(
                await session.execute(
                    select(Site.id, Site.owner_id).where(
                        Site.id.in_({row["site_id"] for row in rows})
                    )
                )
            )
            await session.commit()
            del buffer[:1000]
            for site_id, owner_id in owners:
                broker.site_event(site_id, owner_id, "analytics_flushed", {})


async def accept(beacon: BeaconInput, origin: str, address: str, agent: str) -> int:
    """Validate Origin and reserve the durable daily budget before buffering."""
    async with buffer_lock:
        if len(buffer) + len(beacon.events) > 1000:
            raise HTTPException(503, "Analytics buffer is full; retry later")
        async with session_factory()() as session:
            site = await session.scalar(
                select(Site).where(Site.site_key == beacon.key).with_for_update()
            )
            if not site or site.demo:
                raise HTTPException(403, "Unknown tracker key")
            target = urlsplit(site.url)
            try:
                parsed = urlsplit(origin)
                actual_port = parsed.port or (443 if parsed.scheme == "https" else 80)
            except ValueError as error:
                raise HTTPException(403, "Invalid beacon origin") from error
            expected_port = target.port or (443 if target.scheme == "https" else 80)
            if (
                parsed.scheme != target.scheme
                or parsed.username is not None
                or parsed.password is not None
                or parsed.hostname != target.hostname
                or expected_port != actual_port
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise HTTPException(403, "Beacon origin does not match the monitored site")
            pressure = await session.get(ServiceState, "storage_pressure")
            if pressure and pressure.value == "1":
                raise HTTPException(
                    429, "Analytics ingestion is paused to protect the database storage budget"
                )
            day = now().date().isoformat()
            if site.events_date != day:
                site.events_date, site.events_today = day, 0
            if site.events_today + len(beacon.events) > get_settings().daily_event_limit:
                raise HTTPException(429, "Daily event budget reached")
            site.events_today += len(beacon.events)
            visitor = private_hash(f"{address}:{agent[:500]}")
            stamp = now()
            rows = [
                {
                    "id": identity(),
                    "site_id": site.id,
                    "ts": stamp,
                    "visitor_hash": visitor,
                    "session_hash": private_hash(event.session, "session"),
                    "event_type": event.event_type,
                    "path": event.path,
                    "referrer_host": event.referrer_host,
                    "device": event.device,
                    "tz": event.tz,
                    "timings": {**event.timings, "_view": private_hash(event.view, "view")},
                }
                for event in beacon.events
            ]
            await session.commit()
            buffer.extend(rows)
            active_visitors(site.id)
            if len(active[site.id]) < 5000 or visitor in active[site.id]:
                active[site.id][visitor] = time.monotonic()
            broker.site_event(
                site.id, site.owner_id, "active_visitors", {"count": active_visitors(site.id)}
            )
            if any(event.event_type == "pageview" for event in beacon.events):
                broker.site_event(
                    site.id,
                    site.owner_id,
                    "pageview",
                    {"count": sum(event.event_type == "pageview" for event in beacon.events)},
                )
    if len(buffer) >= 100:
        await flush()
    return len(rows)
