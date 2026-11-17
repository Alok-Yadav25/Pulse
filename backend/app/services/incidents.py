"""Persisted failure/recovery state machine with maintenance suppression."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Incident, Site
from app.services.probe import ProbeResult


def transition(
    status: str, failures: int, successes: int, ok: bool
) -> tuple[str, int, int, str | None]:
    """Fail after three checks; recover only after two consecutive successes."""
    failures, successes = (0, successes + 1) if ok else (failures + 1, 0)
    if status != "down" and not ok and failures >= 3:
        return "down", failures, successes, "incident_opened"
    if status == "down" and ok and successes >= 2:
        return "operational", failures, successes, "incident_resolved"
    if status == "pending" and ok:
        status = "operational"
    return status, failures, successes, None


async def apply_result(
    session: AsyncSession, site: Site, result: ProbeResult, ts: datetime, maintenance: bool
) -> tuple[str | None, Incident | None]:
    """Apply one check atomically with its incident record."""
    if maintenance:
        site.failures = site.successes = 0
        return None, None
    site.status, site.failures, site.successes, event = transition(
        site.status, site.failures, site.successes, result.ok
    )
    incident = await session.scalar(
        select(Incident).where(Incident.site_id == site.id, Incident.resolved_at.is_(None))
    )
    if event == "incident_opened":
        incident = Incident(
            site_id=site.id,
            started_at=ts,
            cause=result.error_type or "unavailable",
            peak_latency_ms=result.total_ms,
        )
        session.add(incident)
    elif event == "incident_resolved" and incident:
        incident.resolved_at = ts
    if incident:
        incident.peak_latency_ms = max(incident.peak_latency_ms or 0, result.total_ms)
    await session.flush()
    return event, incident
