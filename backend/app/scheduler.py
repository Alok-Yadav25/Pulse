"""One-process scheduler with jitter, durable gaps, and an idempotent cron catch-up."""

import asyncio
import logging
import random
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db import session_factory
from app.models import Check, Maintenance, MonitorGap, ServiceState, Site, now
from app.services.alerts import deliver_pending, enqueue
from app.services.analytics import anomaly
from app.services.broker import broker
from app.services.incidents import apply_result
from app.services.ingest import flush
from app.services.probe import ProbeResult, probe
from app.services.rollups import maintain

logger = logging.getLogger("pulse")
scheduler = AsyncIOScheduler(timezone="UTC")
tick_lock = asyncio.Lock()
busy: set[str] = set()
chaos = {"status": 200, "delay_ms": 0}


async def run_site(site_id: str) -> None:
    """Probe outside a transaction, then persist a state transition atomically."""
    if site_id in busy:
        return
    busy.add(site_id)
    try:
        async with session_factory()() as session:
            site = await session.get(Site, site_id)
            if not site:
                return
            url, assertions, demo = site.url, site.assertions, site.demo
        if demo:
            if chaos["delay_ms"]:
                await asyncio.sleep(chaos["delay_ms"] / 1000)
            result = ProbeResult(
                ok=chaos["status"] < 400,
                status_code=chaos["status"],
                total_ms=float(chaos["delay_ms"]),
                error_type="http_5xx" if chaos["status"] >= 500 else None,
            )
        else:
            result = await probe(url, assertions)
        stamp = now()
        async with session_factory()() as session:
            site = await session.get(Site, site_id, with_for_update=True)
            if not site:
                return
            window = await session.scalar(
                select(Maintenance).where(
                    Maintenance.site_id == site.id,
                    Maintenance.starts_at <= stamp,
                    Maintenance.ends_at > stamp,
                )
            )
            session.add(
                Check(site_id=site.id, ts=stamp, maintenance=bool(window), **result.record())
            )
            event, incident = await apply_result(session, site, result, stamp, bool(window))
            site.last_checked_at = stamp
            retry = (
                not result.ok and site.status != "down" and site.failures in {1, 2} and not window
            )
            recovery = site.status == "down" and result.ok and site.successes == 1 and not window
            delay = 5 if retry or recovery else site.interval_s + random.uniform(-2, 2)
            site.next_check_at = stamp + timedelta(seconds=delay)
            if event and incident:
                await enqueue(
                    session,
                    site,
                    event,
                    f"{incident.id}:{event}",
                    {"incident_id": incident.id, "cause": incident.cause},
                )
            if result.tls_days_left is not None:
                for threshold in [1, 7, 14]:
                    if result.tls_days_left <= threshold:
                        await enqueue(
                            session,
                            site,
                            "certificate_expiry",
                            (
                                f"tls:{(stamp + timedelta(days=result.tls_days_left)).date()}"
                                f":{threshold}"
                            ),
                            {"days_left": result.tls_days_left, "threshold": threshold},
                        )
                        break
            recent = list(
                await session.scalars(
                    select(Check.total_ms)
                    .where(Check.site_id == site.id)
                    .order_by(Check.ts.desc())
                    .limit(63)
                )
            )
            insight = anomaly(list(reversed(recent)))
            await session.commit()
            broker.site_event(
                site.id,
                site.owner_id,
                "check_result",
                {"check": result.record(), "status": site.status, "ts": stamp},
            )
            if event and incident:
                broker.site_event(site.id, site.owner_id, event, {"incident_id": incident.id})
            if insight:
                broker.site_event(site.id, site.owner_id, "anomaly", insight)
    finally:
        busy.discard(site_id)


async def heartbeat() -> None:
    """Detect restarts/sleep from a durable heartbeat without inventing target downtime."""
    async with session_factory()() as session:
        state = await session.get(ServiceState, "heartbeat", with_for_update=True)
        stamp = now()
        if state:
            previous = datetime.fromisoformat(state.value)
            if (stamp - previous).total_seconds() > 120:
                session.add(
                    MonitorGap(
                        started_at=previous + timedelta(seconds=15),
                        ended_at=stamp,
                        reason="monitor_unavailable",
                    )
                )
            state.value = stamp.isoformat()
        else:
            session.add(ServiceState(key="heartbeat", value=stamp.isoformat()))
        await session.commit()


async def check_due() -> None:
    """Run at most ten due sites, with no duplicate in-flight probe per site."""
    async with session_factory()() as session:
        ids = list(
            await session.scalars(
                select(Site.id)
                .where(Site.next_check_at <= now())
                .order_by(Site.next_check_at)
                .limit(10)
            )
        )
    await asyncio.gather(*(run_site(site_id) for site_id in ids), return_exceptions=True)


async def tick() -> dict:
    """Share one maintenance path between external cron and the internal scheduler."""
    if tick_lock.locked():
        return {"status": "already_running"}
    async with tick_lock:
        await heartbeat()
        await check_due()
        await flush()
        await maintain()
        await deliver_pending()
        return {"status": "ok", "ts": now().isoformat()}


async def guarded(job) -> None:
    """Log error classes only; URL credentials and visitor addresses never enter logs."""
    try:
        await job()
    except Exception as error:
        logger.warning("Background task failed: %s", type(error).__name__)


def start() -> None:
    """Start jobs once, in the same single uvicorn worker as the broker."""
    scheduler.add_job(
        guarded,
        "interval",
        seconds=1,
        args=[check_due],
        max_instances=1,
        coalesce=True,
        id="probes",
        replace_existing=True,
    )
    scheduler.add_job(
        guarded,
        "interval",
        seconds=2,
        args=[flush],
        max_instances=1,
        coalesce=True,
        id="beacons",
        replace_existing=True,
    )
    scheduler.add_job(
        guarded,
        "interval",
        seconds=15,
        args=[heartbeat],
        max_instances=1,
        coalesce=True,
        id="heartbeat",
        replace_existing=True,
    )
    scheduler.add_job(
        guarded,
        "interval",
        seconds=60,
        args=[tick],
        max_instances=1,
        coalesce=True,
        id="maintenance",
        replace_existing=True,
    )
    scheduler.start()
