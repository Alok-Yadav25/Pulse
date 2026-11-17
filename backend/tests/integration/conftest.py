"""Recreate only the explicitly supplied disposable test database."""

import os

import httpx
import pytest

from app.config import get_settings
from app.db import Base, get_engine
from app.main import app
from app.services.ingest import active, buffer
from app.services.security import limiter


@pytest.fixture
async def client(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable Postgres database")
    if "test" not in url:
        pytest.fail("TEST_DATABASE_URL must name an explicitly disposable test database")
    monkeypatch.setattr(get_settings(), "database_url", url)
    get_engine.cache_clear()
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    limiter.buckets.clear()
    active.clear()
    buffer.clear()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as transport:
        yield transport
    buffer.clear()
    await engine.dispose()
    get_engine.cache_clear()


@pytest.fixture
async def account(client):
    response = await client.post(
        "/api/auth/register",
        json={"email": "owner@example.com", "password": "secure-test-password"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}
