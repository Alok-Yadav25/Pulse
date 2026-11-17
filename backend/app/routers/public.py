"""Public status, tracker ingestion, SSE, cron, and the bounded chaos demo."""

import asyncio
import hmac
import html
import json
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import ValidationError
from sqlalchemy import select

from app.config import get_settings
from app.db import session_factory
from app.models import Incident, Maintenance, Site, User, now
from app.routers.sites import owned, record
from app.scheduler import chaos, run_site, tick
from app.schemas import BeaconInput
from app.services.analytics import summary
from app.services.broker import broker
from app.services.ingest import accept
from app.services.security import current_user, limiter, rate_limit

router = APIRouter(tags=["public and live"])
demo_lock = asyncio.Lock()
demo_reset: asyncio.Task | None = None


@router.get("/api/public/{slug}")
async def public_status(slug: str) -> dict:
    """Expose opted-in status without tracker keys or private target paths and queries."""
    async with session_factory()() as session:
        site = await session.scalar(
            select(Site).where(Site.slug == slug, Site.public_status.is_(True))
        )
        if not site:
            raise HTTPException(404, "Public status page not found")
        metrics = await summary(session, site, "24h")
        incidents = list(
            await session.scalars(
                select(Incident)
                .where(Incident.site_id == site.id)
                .order_by(Incident.started_at.desc())
                .limit(30)
            )
        )
        windows = list(
            await session.scalars(
                select(Maintenance)
                .where(Maintenance.site_id == site.id, Maintenance.ends_at >= now())
                .order_by(Maintenance.starts_at)
                .limit(10)
            )
        )
        return {
            "site": {
                "name": site.name,
                "slug": site.slug,
                "status": site.status,
                "host": urlsplit(site.url).hostname,
                "demo": site.demo,
            },
            "summary": metrics,
            "incidents": [record(row) for row in incidents],
            "maintenance": [record(row) for row in windows],
        }


@router.get("/api/public/{slug}/incidents/{incident_id}")
async def public_incident(slug: str, incident_id: str) -> dict:
    """Provide a shareable incident without exposing private monitoring configuration."""
    data = await public_status(slug)
    incident = next((row for row in data["incidents"] if row["id"] == incident_id), None)
    if not incident:
        raise HTTPException(404, "Public incident not found")
    return {"site": data["site"], "incident": incident}


@router.get("/badge/{slug}.svg")
async def badge(slug: str) -> Response:
    """Render observed uptime and an explicit unknown state into a cached SVG badge."""
    data = await public_status(slug)
    uptime = data["summary"]["uptime"]
    value = f"{uptime:.2f}%" if uptime is not None else "unknown"
    color = "#287d49" if data["site"]["status"] == "operational" else "#9d671d"
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="154" height="22" '
        f'role="img" aria-label="Uptime: {html.escape(value)}">'
        f'<rect width="154" height="22" rx="4" fill="#242a28"/>'
        f'<path fill="{color}" d="M65 0h85q4 0 4 4v14q0 4-4 4H65z"/>'
        f'<g fill="white" font-family="Verdana,sans-serif" font-size="11" text-anchor="middle">'
        f'<text x="32" y="15">uptime</text>'
        f'<text x="110" y="15">{html.escape(value)}</text>'
        f"</g>"
        f"</svg>"
    )
    return Response(
        svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "public,max-age=60",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
    )


@router.get("/api/stream/{site_id}")
async def stream(
    site_id: str, request: Request, user: User = Depends(current_user)
) -> StreamingResponse:
    """Use bearer-authenticated fetch SSE so credentials never appear in URLs."""
    if site_id == "all":
        topic = f"user:{user.id}"
    else:
        async with session_factory()() as session:
            await owned(session, site_id, user)
        topic = f"site:{site_id}"
    try:
        queue = broker.subscribe(topic)
    except OverflowError as error:
        raise HTTPException(503, str(error)) from error

    async def events():
        try:
            yield "retry: 5000\n\n"
            while not await request.is_disconnected():
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=20)
                    if message is None:
                        break
                    yield message
                except TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            broker.unsubscribe(topic, queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.post("/ingest", status_code=202)
async def ingest(request: Request) -> dict:
    """Bound body bytes before JSON parsing; enforce both the public key and exact Origin."""
    rate_limit(request, "ingest-ip", 120)
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 4096:
            raise HTTPException(413, "Beacon payload must be at most 4 KiB")
    try:
        data = BeaconInput.model_validate_json(raw)
    except ValidationError as error:
        raise HTTPException(422, "Invalid beacon payload") from error
    if not limiter.allow(f"key:{data.key}", 600):
        raise HTTPException(429, "Tracker key rate limit exceeded")
    count = await accept(
        data,
        request.headers.get("origin", ""),
        request.client.host if request.client else "",
        request.headers.get("user-agent", ""),
    )
    return {"accepted": count}


@router.get("/t.js")
async def tracker() -> FileResponse:
    """Serve the dependency-free tracker with explicit caching/version semantics."""
    return FileResponse(
        Path(__file__).parents[1] / "static" / "t.js",
        media_type="text/javascript",
        headers={
            "Cache-Control": "public, max-age=86400",
            "ETag": '"pulse-tracker-v1"',
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/api/cron/tick")
async def cron(request: Request) -> dict:
    """Secret-authenticated catch-up shares the internal scheduler's idempotency lock."""
    secret = get_settings().cron_secret
    if len(secret) < 32 or not hmac.compare_digest(
        request.headers.get("x-cron-secret", ""), secret
    ):
        raise HTTPException(403, "Invalid cron secret")
    return await tick()


async def demo_site(user: User) -> Site:
    """Seed only a controlled in-process target; arbitrary internal URLs stay prohibited."""
    if not user.demo or not get_settings().demo_enabled:
        raise HTTPException(403, "This action is limited to the controlled demo")
    async with demo_lock, session_factory()() as session:
        site = await session.scalar(
            select(Site).where(Site.owner_id == user.id, Site.demo.is_(True))
        )
        if not site:
            site = Site(
                owner_id=user.id,
                name="Pulse chaos target",
                url="demo://pulse-chaos",
                slug="pulse-demo",
                demo=True,
                public_status=True,
                interval_s=5,
            )
            session.add(site)
            await session.commit()
        return site


@router.post("/api/demo/start")
async def start_demo(user: User = Depends(current_user)) -> dict:
    """Ensure the read-only demo account has its controlled monitor."""
    return {"site_id": (await demo_site(user)).id}


@router.post("/api/demo/break")
async def break_demo(request: Request, user: User = Depends(current_user)) -> dict:
    """Trigger a bounded 45-second incident in the controlled demo only."""
    global demo_reset
    rate_limit(request, "chaos", 5)
    site = await demo_site(user)
    chaos.update(status=503, delay_ms=0)
    if demo_reset:
        demo_reset.cancel()

    async def reset():
        await asyncio.sleep(45)
        chaos.update(status=200, delay_ms=0)

    demo_reset = asyncio.create_task(reset())
    await run_site(site.id)
    return {"status": "failing", "recovers_in_s": 45}


@router.post("/api/demo/recover")
async def recover_demo(user: User = Depends(current_user)) -> dict:
    """Restore the controlled target; closure still needs two successful checks."""
    site = await demo_site(user)
    chaos.update(status=200, delay_ms=0)
    await run_site(site.id)
    return {"status": "recovering"}


@router.get("/api/demo/target")
async def chaos_target(delay_ms: int = 0, status: int = 200) -> Response:
    """Public test endpoint with a strict delay cap and a small allowed status set."""
    if not get_settings().demo_enabled:
        raise HTTPException(404, "Demo disabled")
    await asyncio.sleep(max(0, min(delay_ms, 3000)) / 1000)
    return Response(
        json.dumps({"service": "pulse-chaos", "ok": status < 400}),
        status_code=status if status in {200, 400, 500, 503} else 200,
        media_type="application/json",
    )
