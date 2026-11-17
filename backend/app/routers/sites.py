"""Owned monitor CRUD, diagnostics, maintenance, deployments, and alert controls."""

import asyncio
import re
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import session_factory
from app.models import (
    AlertChannel,
    AlertLog,
    Check,
    Deployment,
    Incident,
    Maintenance,
    ServiceState,
    Site,
    SiteProfile,
    User,
    now,
)
from app.schemas import AlertInput, DeploymentInput, MaintenanceInput, SiteInput
from app.services.analytics import RANGES, summary, traffic
from app.services.broker import broker
from app.services.ingest import active, active_visitors, buffer, buffer_lock
from app.services.profiler import profile
from app.services.security import current_user, limiter, writable
from app.services.ssrf import UnsafeURL, resolve_target

router = APIRouter(prefix="/api/sites", tags=["monitors"])
create_lock = asyncio.Lock()


def record(model) -> dict:
    """Serialize mapped columns without triggering relationship lazy loads."""
    return {column.name: getattr(model, column.name) for column in model.__table__.columns}


async def owned(session: AsyncSession, site_id: str, user: User, write: bool = False) -> Site:
    """Use the same ownership boundary for all subordinate resources."""
    if write:
        writable(user)
        if not limiter.allow(f"write:{user.id}", 60):
            raise HTTPException(429, "Workspace write limit reached")
    site = await session.get(Site, site_id)
    if not site or site.owner_id != user.id:
        raise HTTPException(404, "Monitor not found")
    return site


async def safe_url(url: str) -> str:
    """Fail closed before creating a monitor or webhook; probing validates again."""
    try:
        async with asyncio.timeout(5):
            return (await resolve_target(url)).url
    except (UnsafeURL, OSError, ValueError, TimeoutError) as error:
        raise HTTPException(
            422, "URL must resolve exclusively to public addresses on an allowed port"
        ) from error


def monitor(site: Site) -> dict:
    """Send private site configuration only to its owner."""
    result = record(site)
    result.pop("owner_id", None)
    result.pop("events_date", None)
    result.pop("events_today", None)
    result["active_visitors"] = active_visitors(site.id)
    result["stale"] = (
        not site.last_checked_at
        or (now() - site.last_checked_at).total_seconds() > site.interval_s * 2
    )
    return result


@router.get("")
async def list_sites(user: User = Depends(current_user)) -> list[dict]:
    """List only the current owner's monitors."""
    async with session_factory()() as session:
        sites = list(
            await session.scalars(
                select(Site).where(Site.owner_id == user.id).order_by(Site.created_at)
            )
        )
        return [monitor(site) for site in sites]


@router.post("", status_code=201)
async def create_site(data: SiteInput, user: User = Depends(current_user)) -> dict:
    """Preserve the entire validated URL and enforce local and deployment quotas."""
    writable(user)
    url = await safe_url(data.url)
    async with create_lock, session_factory()() as session:
        count = (
            await session.scalar(select(func.count()).select_from(Site).where(Site.demo.is_(False)))
        ) or 0
        personal = (
            await session.scalar(
                select(func.count()).select_from(Site).where(Site.owner_id == user.id)
            )
        ) or 0
        if personal >= 10 or count >= get_settings().max_sites:
            raise HTTPException(409, "Monitor capacity reached for this free deployment")
        slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")[:40] or "site"
        site = Site(
            owner_id=user.id,
            **{**data.model_dump(), "url": url, "slug": f"{slug}-{secrets.token_hex(4)}"},
        )
        session.add(site)
        await session.commit()
        return monitor(site)


@router.get("/{site_id}")
async def get_site(site_id: str, user: User = Depends(current_user)) -> dict:
    """Return one owned monitor."""
    async with session_factory()() as session:
        return monitor(await owned(session, site_id, user))


@router.patch("/{site_id}")
async def update_site(site_id: str, data: SiteInput, user: User = Depends(current_user)) -> dict:
    """Update a complete configuration after checking ownership and public resolution."""
    async with session_factory()() as session:
        site = await owned(session, site_id, user, True)
        values = data.model_dump()
        values["url"] = await safe_url(data.url)
        for name, value in values.items():
            setattr(site, name, value)
        await session.commit()
        return monitor(site)


@router.delete("/{site_id}", status_code=204)
async def delete_site(site_id: str, user: User = Depends(current_user)) -> None:
    """Cascade deletion through every site-owned time-series and configuration table."""
    async with buffer_lock, session_factory()() as session:
        site = await owned(session, site_id, user, True)
        await session.delete(site)
        await session.execute(delete(ServiceState).where(ServiceState.key == f"rollup:{site_id}"))
        await session.commit()
        buffer[:] = [row for row in buffer if row["site_id"] != site_id]
        active.pop(site_id, None)


@router.get("/{site_id}/checks")
async def checks(
    site_id: str, range: str = "24h", user: User = Depends(current_user)
) -> list[dict]:
    """Return at most 1000 raw checks; summaries use all retained observations."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        rows = await session.scalars(
            select(Check)
            .where(
                Check.site_id == site_id,
                Check.ts >= now() - timedelta(seconds=RANGES.get(range, 86400)),
            )
            .order_by(Check.ts.desc())
            .limit(1000)
        )
        return [record(row) for row in rows]


@router.get("/{site_id}/summary")
async def site_summary(
    site_id: str, range: str = "24h", user: User = Depends(current_user)
) -> dict:
    """Return actual observed percentiles, coverage, and gap-aware uptime."""
    async with session_factory()() as session:
        site = await owned(session, site_id, user)
        return await summary(session, site, range)


@router.get("/{site_id}/traffic")
async def site_traffic(
    site_id: str, range: str = "24h", user: User = Depends(current_user)
) -> dict:
    """Return bounded real-user aggregates with approximation labels."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        return {
            **await traffic(session, site_id, range),
            "active_visitors": active_visitors(site_id),
        }


@router.get("/{site_id}/vitals")
async def vitals(site_id: str, user: User = Depends(current_user)) -> dict:
    """Expose p75 Web Vitals using their actual observed population."""
    return (await site_traffic(site_id, "24h", user))["vitals"]


@router.get("/{site_id}/incidents")
async def incidents(site_id: str, user: User = Depends(current_user)) -> list[dict]:
    """Return the durable incident timeline for this site."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        return [
            record(row)
            for row in await session.scalars(
                select(Incident)
                .where(Incident.site_id == site_id)
                .order_by(Incident.started_at.desc())
                .limit(100)
            )
        ]


@router.get("/{site_id}/incidents/{incident_id}/report")
async def report(
    site_id: str, incident_id: str, user: User = Depends(current_user)
) -> PlainTextResponse:
    """Generate a downloadable Markdown report with actual checks and release markers."""
    async with session_factory()() as session:
        site = await owned(session, site_id, user)
        incident = await session.get(Incident, incident_id)
        if not incident or incident.site_id != site.id:
            raise HTTPException(404, "Incident not found")
        end = incident.resolved_at or now()
        rows = list(
            await session.scalars(
                select(Check)
                .where(
                    Check.site_id == site.id,
                    Check.ts >= incident.started_at - timedelta(seconds=site.interval_s),
                    Check.ts <= end,
                )
                .order_by(Check.ts)
                .limit(1000)
            )
        )
        deployments = list(
            await session.scalars(
                select(Deployment).where(
                    Deployment.site_id == site.id,
                    Deployment.ts >= incident.started_at - timedelta(hours=1),
                    Deployment.ts <= end,
                )
            )
        )
        lines = [
            f"# Incident report: {site.name}",
            "",
            f"Incident: {incident.id}",
            f"Status: {'Resolved' if incident.resolved_at else 'Open'}",
            f"Cause: {incident.cause}",
            f"Started: {incident.started_at.isoformat()}",
            f"Duration: {round((end - incident.started_at).total_seconds())} seconds",
            f"Peak latency: {incident.peak_latency_ms:.2f} ms",
            "",
            "## Timeline",
            "",
        ]
        lines += [
            (
                f"- {row.ts.isoformat()} — {'OK' if row.ok else row.error_type}, "
                f"HTTP {row.status_code or '—'}, {row.total_ms:.2f} ms"
            )
            for row in rows
        ]
        lines += ["", "## Nearby deployments", ""] + [
            f"- {row.ts.isoformat()} — {row.version}: {row.notes}" for row in deployments
        ]
        lines += ["", "## Notes", incident.notes or "No notes supplied."]
        return PlainTextResponse(
            "\n".join(lines),
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="pulse-incident-{incident.id}.md"'
            },
        )


@router.get("/{site_id}/maintenance")
async def maintenance(site_id: str, user: User = Depends(current_user)) -> list[dict]:
    """List current and upcoming maintenance windows."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        return [
            record(row)
            for row in await session.scalars(
                select(Maintenance)
                .where(
                    Maintenance.site_id == site_id, Maintenance.ends_at > now() - timedelta(days=7)
                )
                .order_by(Maintenance.starts_at)
                .limit(100)
            )
        ]


@router.post("/{site_id}/maintenance", status_code=201)
async def add_maintenance(
    site_id: str, data: MaintenanceInput, user: User = Depends(current_user)
) -> dict:
    """Schedule a bounded window; checks continue while new incident alerts are suppressed."""
    async with session_factory()() as session:
        await owned(session, site_id, user, True)
        row = Maintenance(site_id=site_id, **data.model_dump())
        session.add(row)
        await session.commit()
        return record(row)


@router.delete("/{site_id}/maintenance/{window_id}", status_code=204)
async def cancel_maintenance(
    site_id: str, window_id: str, user: User = Depends(current_user)
) -> None:
    """Cancel future maintenance; preserve elapsed history for accurate uptime math."""
    async with session_factory()() as session:
        await owned(session, site_id, user, True)
        row = await session.get(Maintenance, window_id)
        if not row or row.site_id != site_id:
            raise HTTPException(404, "Maintenance not found")
        if row.starts_at < now():
            row.ends_at = min(row.ends_at, now())
        else:
            await session.delete(row)
        await session.commit()


@router.get("/{site_id}/deployments")
async def deployments(site_id: str, user: User = Depends(current_user)) -> list[dict]:
    """Return release markers for the chart and incident reports."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        return [
            record(row)
            for row in await session.scalars(
                select(Deployment)
                .where(Deployment.site_id == site_id)
                .order_by(Deployment.ts.desc())
                .limit(100)
            )
        ]


@router.post("/{site_id}/deployments", status_code=201)
async def add_deployment(
    site_id: str, data: DeploymentInput, user: User = Depends(current_user)
) -> dict:
    """Record a release marker; CI can call this endpoint using a bearer token."""
    async with session_factory()() as session:
        site = await owned(session, site_id, user, True)
        row = Deployment(site_id=site_id, **data.model_dump())
        session.add(row)
        await session.commit()
        broker.site_event(
            site.id,
            site.owner_id,
            "deployment",
            {"id": row.id, "version": row.version, "ts": row.ts},
        )
        return record(row)


@router.get("/{site_id}/alerts")
async def alerts(site_id: str, user: User = Depends(current_user)) -> dict:
    """Return delivery state without exposing stored webhook secrets in responses."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        channels = list(
            await session.scalars(select(AlertChannel).where(AlertChannel.site_id == site_id))
        )
        logs = list(
            await session.scalars(
                select(AlertLog)
                .where(AlertLog.site_id == site_id)
                .order_by(AlertLog.ts.desc())
                .limit(50)
            )
        )
        return {
            "channels": [
                {k: v for k, v in record(row).items() if k != "target"} for row in channels
            ],
            "deliveries": [
                {k: v for k, v in record(row).items() if k != "payload"} for row in logs
            ],
        }


@router.post("/{site_id}/alerts", status_code=201)
async def add_alert(site_id: str, data: AlertInput, user: User = Depends(current_user)) -> dict:
    """SSRF-validate webhook destinations before storing them."""
    async with session_factory()() as session:
        await owned(session, site_id, user, True)
        if (
            await session.scalar(
                select(func.count())
                .select_from(AlertChannel)
                .where(AlertChannel.site_id == site_id)
            )
            or 0
        ) >= 3:
            raise HTTPException(409, "At most three alert channels per monitor")
        target = await safe_url(data.target)
        if not target.startswith("https://"):
            raise HTTPException(422, "Webhook destinations must use HTTPS")
        if data.type == "telegram":
            target += "?" + urlencode({"chat_id": data.chat_id})
        channel = AlertChannel(
            site_id=site_id, **{**data.model_dump(exclude={"chat_id"}), "target": target}
        )
        session.add(channel)
        await session.commit()
        return {k: v for k, v in record(channel).items() if k != "target"}


@router.delete("/{site_id}/alerts/{channel_id}", status_code=204)
async def delete_alert(site_id: str, channel_id: str, user: User = Depends(current_user)) -> None:
    """Remove an alert channel and its delivery log."""
    async with session_factory()() as session:
        await owned(session, site_id, user, True)
        row = await session.get(AlertChannel, channel_id)
        if not row or row.site_id != site_id:
            raise HTTPException(404, "Alert channel not found")
        await session.delete(row)
        await session.commit()


@router.get("/{site_id}/profile")
async def get_profile(site_id: str, user: User = Depends(current_user)) -> dict:
    """Return cached profile data without making a surprise outbound request."""
    async with session_factory()() as session:
        await owned(session, site_id, user)
        row = await session.get(SiteProfile, site_id)
        return {"data": row.data if row else None, "fetched_at": row.fetched_at if row else None}


@router.post("/{site_id}/profile/refresh")
async def refresh_profile(
    site_id: str, request: Request, user: User = Depends(current_user)
) -> dict:
    """Cache rule-based profiles for 24h using the pinned-IP client."""
    async with session_factory()() as session:
        site = await owned(session, site_id, user, True)
        row = await session.get(SiteProfile, site_id)
        if row and now() - row.fetched_at < timedelta(hours=24):
            return {"data": row.data, "fetched_at": row.fetched_at}
        url = site.url
    try:
        data = await profile(url)
    except ValueError as error:
        raise HTTPException(422, "Homepage could not be profiled") from error
    async with session_factory()() as session:
        await owned(session, site_id, user, True)
        row = await session.get(SiteProfile, site_id)
        if row:
            row.data, row.fetched_at = data, now()
        else:
            row = SiteProfile(site_id=site_id, data=data)
            session.add(row)
        await session.commit()
        return {"data": row.data, "fetched_at": row.fetched_at}
