"""Pulse's single-worker async API and background job lifecycle."""

import logging
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

import asyncpg
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import get_engine, session_factory
from app.routers import auth, public, sites
from app.scheduler import guarded, heartbeat, scheduler, start
from app.services.ingest import flush
from app.services.security import BodyLimitMiddleware

logger = logging.getLogger("pulse")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Keep liveness independent from DB availability; background tasks retry safely."""
    if get_settings().scheduler_enabled:
        await guarded(heartbeat)
        start()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
    await guarded(flush)
    if get_engine.cache_info().currsize:
        await get_engine().dispose()


app = FastAPI(
    title="Pulse API",
    version="1.0.0",
    lifespan=lifespan,
    description="Public URL checks, private analytics, and incident management.",
)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Cron-Secret"],
)
app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(public.router)


@app.middleware("http")
async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Apply security headers without logging addresses or sensitive target URLs."""
    response = await call_next(request)
    response.headers.update(
        {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        }
    )
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(SQLAlchemyError)
@app.exception_handler(OSError)
@app.exception_handler(asyncpg.PostgresError)
async def database_unavailable(request: Request, error: SQLAlchemyError) -> JSONResponse:
    """Do not leak connection strings or SQL through an error response."""
    logger.warning("Database request failed: %s", type(error).__name__)
    return JSONResponse(
        {"detail": "Database is temporarily unavailable. Retry shortly."},
        status_code=503,
        headers={"Retry-After": "5"},
    )


@app.get("/healthz")
async def healthz() -> dict:
    """Cheap process liveness; never touches the database."""
    return {"status": "ok", "service": "pulse"}


@app.get("/readyz")
async def readyz() -> dict:
    """Separate database readiness from cheap process liveness."""
    settings = get_settings()
    if any(
        len(value) < 32
        for value in [settings.jwt_secret, settings.salt_secret, settings.cron_secret]
    ):
        from fastapi import HTTPException

        raise HTTPException(
            503, "JWT_SECRET, SALT_SECRET, and CRON_SECRET require at least 32 characters"
        )
    async with session_factory()() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get("/api/meta")
async def metadata() -> dict:
    """Expose shipped capabilities and explicit resource limits."""
    return {
        "name": "Pulse",
        "version": "1.0.0",
        "capabilities": [
            "auth",
            "probes",
            "incidents",
            "traffic",
            "vitals",
            "sse",
            "maintenance",
            "deployments",
            "assertions",
            "alerts",
            "profiles",
            "status",
            "reports",
        ],
        "limits": {
            "sites": get_settings().max_sites,
            "daily_events_per_site": get_settings().daily_event_limit,
        },
    }


@app.get("/info")
async def bot_info() -> dict:
    """Identify the monitor's purpose and privacy policy for target-site operators."""
    return {
        "bot": "PulseBot/1.0",
        "purpose": "Owner-configured public website health checks",
        "contact": get_settings().cors_origins[0]
        if get_settings().cors_origins
        else "Configure ALLOWED_ORIGINS",
        "privacy": "No raw visitor IP addresses are stored by Pulse.",
    }


@app.get("/api/overview")
async def overview(range: str = "24h", user=Depends(auth.current_user)) -> dict:
    """Compute whole-workspace percentiles from the full observation population."""
    from app.models import Site
    from app.services.analytics import percentiles, summary

    async with session_factory()() as session:
        records = list(await session.scalars(select(Site).where(Site.owner_id == user.id)))
        metrics = [await summary(session, site, range, samples=True) for site in records]
    values = [v for item in metrics for v in item.pop("_samples")]
    observed = sum(item["observed_s"] for item in metrics)
    up = sum(item["up_s"] for item in metrics)
    chart = sorted((point for item in metrics for point in item["chart"]), key=lambda p: p["ts"])
    return {
        **percentiles(values),
        "uptime": up / observed * 100 if observed else None,
        "coverage": sum(item["coverage"] or 0 for item in metrics) / len(metrics)
        if metrics
        else None,
        "observed_s": observed,
        "up_s": up,
        "count": len(values),
        "chart": chart[-1000:],
        "excluded_s": sum(item["excluded_s"] for item in metrics),
        "gaps": [gap for item in metrics for gap in item["gaps"]],
        "stale": any(item["stale"] for item in metrics),
        "last_checked_at": max(
            (item["last_checked_at"] for item in metrics if item["last_checked_at"]), default=None
        ),
        "insight": next((item["insight"] for item in metrics if item["insight"]), None),
    }
