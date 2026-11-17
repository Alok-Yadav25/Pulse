"""Phase 0 API: cheap health checks and an honest capability description."""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings

app = FastAPI(
    title="Pulse API",
    version="0.1.0",
    description="Phase 0 foundation. Probing, authentication, and analytics are not enabled yet.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)


class HealthResponse(BaseModel):
    """Liveness only: not a database or target-website health report."""

    status: str = "ok"
    service: str = "pulse"
    phase: int = 0


@app.middleware("http")
async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Apply safe defaults without disrupting the local OpenAPI explorer."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


@app.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    """Return liveness without database access or external network requests."""
    return HealthResponse()


@app.get("/api/meta")
async def metadata() -> dict[str, str | int | list[str]]:
    """Report only capabilities that actually exist in this scaffold."""
    return {"name": "Pulse", "phase": 0, "mode": "scaffold", "capabilities": ["health", "openapi"]}
