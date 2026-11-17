"""The foundation stays available even if the database is absent."""

import httpx

from app.db import async_database_url, get_engine
from app.main import app


async def test_health_does_not_create_database_pool() -> None:
    get_engine.cache_clear()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "pulse"}
    assert get_engine.cache_info().currsize == 0
    assert response.headers["X-Content-Type-Options"] == "nosniff"


async def test_cors_is_explicit() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        allowed = await client.get("/healthz", headers={"Origin": "http://localhost:5173"})
        blocked = await client.get("/healthz", headers={"Origin": "https://untrusted.example"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in blocked.headers


async def test_metadata_and_openapi_are_honest() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://test"
    ) as client:
        response = await client.get("/api/meta")
        schema = await client.get("/openapi.json")
        absent = await client.get("/api/sites")
    assert "probes" in response.json()["capabilities"]
    assert schema.status_code == 200
    assert absent.status_code == 401
    assert response.headers["strict-transport-security"] == "max-age=31536000"


def test_database_url_normalization() -> None:
    assert (
        async_database_url("postgres://u:p@localhost/db") == "postgresql+asyncpg://u:p@localhost/db"
    )
    assert (
        async_database_url("postgresql://u:p@localhost/db")
        == "postgresql+asyncpg://u:p@localhost/db"
    )
    assert async_database_url("postgresql+asyncpg://u:p@localhost/db").startswith(
        "postgresql+asyncpg://"
    )


def test_neon_tls_url_normalization() -> None:
    url = async_database_url(
        "postgresql://u:p@pooler.example/db?sslmode=require&channel_binding=require"
    )
    assert "ssl=require" in url
    assert "sslmode" not in url
    assert "channel_binding" not in url
