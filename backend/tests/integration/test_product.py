"""Postgres-backed ownership, ingestion, incident, rollup, and recommendation flows."""

from datetime import timedelta
from unittest.mock import AsyncMock

from sqlalchemy import func, select

from app.db import session_factory
from app.models import (
    AlertChannel,
    AlertLog,
    Check,
    Rollup,
    RumEvent,
    Site,
    now,
)
from app.scheduler import run_site
from app.services.alerts import enqueue
from app.services.ingest import flush
from app.services.probe import ProbeResult
from app.services.rollups import build_bucket, maintain
from app.services.ssrf import normalize_url


async def create(client, account, monkeypatch):
    monkeypatch.setattr("app.routers.sites.safe_url", AsyncMock(side_effect=normalize_url))
    response = await client.post(
        "/api/sites",
        headers=account,
        json={
            "name": "Main",
            "url": "https://example.com/health?region=in",
            "public_status": True,
            "group": "Production",
            "tags": ["API"],
            "assertions": {"status_codes": [200], "json_path": "ok", "equals": True},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_crud_preserves_full_url_and_enforces_ownership(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    assert site["url"] == "https://example.com/health?region=in"
    assert site["tags"] == ["API"]
    assert (await client.get(f"/api/sites/{site['id']}")).status_code == 401
    other = await client.post(
        "/api/auth/register", json={"email": "other@example.com", "password": "other-test-password"}
    )
    headers = {"Authorization": "Bearer " + other.json()["access_token"]}
    for suffix in [
        "",
        "/checks",
        "/summary",
        "/traffic",
        "/incidents",
        "/alerts",
        "/maintenance",
        "/deployments",
        "/profile",
    ]:
        assert (
            await client.get(f"/api/sites/{site['id']}{suffix}", headers=headers)
        ).status_code == 404
    assert (await client.delete(f"/api/sites/{site['id']}", headers=headers)).status_code == 404


async def test_incident_confirmation_recovery_and_report(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    monkeypatch.setattr(
        "app.scheduler.probe",
        AsyncMock(
            return_value=ProbeResult(ok=False, status_code=503, total_ms=500, error_type="http_5xx")
        ),
    )
    for _ in range(2):
        await run_site(site["id"])
        assert (
            await client.get(f"/api/sites/{site['id']}/incidents", headers=account)
        ).json() == []
    await run_site(site["id"])
    incident = (await client.get(f"/api/sites/{site['id']}/incidents", headers=account)).json()[0]
    monkeypatch.setattr(
        "app.scheduler.probe",
        AsyncMock(return_value=ProbeResult(ok=True, status_code=200, total_ms=75)),
    )
    await run_site(site["id"])
    assert (await client.get(f"/api/sites/{site['id']}", headers=account)).json()[
        "status"
    ] == "down"
    await run_site(site["id"])
    assert (await client.get(f"/api/sites/{site['id']}", headers=account)).json()[
        "status"
    ] == "operational"
    report = await client.get(
        f"/api/sites/{site['id']}/incidents/{incident['id']}/report", headers=account
    )
    assert report.status_code == 200 and "Status: Resolved" in report.text
    public = await client.get(f"/api/public/{site['slug']}")
    assert public.status_code == 200
    assert "site_key" not in public.text and "region=in" not in public.text


async def test_maintenance_suppresses_incident_and_excludes_coverage(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    response = await client.post(
        f"/api/sites/{site['id']}/maintenance",
        headers=account,
        json={
            "title": "Deploy",
            "starts_at": (now() - timedelta(minutes=1)).isoformat(),
            "ends_at": (now() + timedelta(minutes=10)).isoformat(),
        },
    )
    assert response.status_code == 201
    monkeypatch.setattr(
        "app.scheduler.probe", AsyncMock(return_value=ProbeResult(ok=False, error_type="timeout"))
    )
    for _ in range(3):
        await run_site(site["id"])
    assert (await client.get(f"/api/sites/{site['id']}/incidents", headers=account)).json() == []
    summary = (await client.get(f"/api/sites/{site['id']}/summary", headers=account)).json()
    assert summary["maintenance"]
    assert summary["uptime"] is None


async def test_ingestion_origin_privacy_budgets_and_cascade(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    payload = {
        "key": site["site_key"],
        "events": [
            {
                "event_type": "pageview",
                "session": "session-abcdefgh",
                "path": "/pricing?secret=hidden",
                "device": "desktop",
                "tz": "Asia/Kolkata",
            }
        ],
    }
    assert (
        await client.post("/ingest", json=payload, headers={"Origin": "https://evil.example"})
    ).status_code == 403
    assert (
        await client.post("/ingest", content=b"x" * 4097, headers={"Origin": "https://example.com"})
    ).status_code == 413
    assert (
        await client.post("/ingest", json=payload, headers={"Origin": "https://example.com"})
    ).status_code == 202
    await flush()
    async with session_factory()() as session:
        event = await session.scalar(select(RumEvent))
        assert event.path == "/pricing"
        assert len(event.visitor_hash) == 64
        assert "ip" not in RumEvent.__table__.columns
    response = await client.get(f"/api/sites/{site['id']}/traffic", headers=account)
    assert response.json()["page_views"] == 1
    assert (await client.delete(f"/api/sites/{site['id']}", headers=account)).status_code == 204
    async with session_factory()() as session:
        assert await session.scalar(select(func.count()).select_from(RumEvent)) == 0


async def test_release_markers_and_grouped_alerts(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    marker = await client.post(
        f"/api/sites/{site['id']}/deployments",
        headers=account,
        json={"version": "v1.2.3", "notes": "New checkout"},
    )
    assert marker.status_code == 201
    assert (await client.get(f"/api/sites/{site['id']}/deployments", headers=account)).json()[0][
        "version"
    ] == "v1.2.3"
    channel = await client.post(
        f"/api/sites/{site['id']}/alerts",
        headers=account,
        json={"type": "webhook", "target": "https://example.com/hook/secret", "cooldown_s": 60},
    )
    assert channel.status_code == 201 and "target" not in channel.json()
    async with session_factory()() as session:
        model = await session.get(Site, site["id"])
        await enqueue(session, model, "incident_opened", "incident:1", {})
        await session.flush()
        await enqueue(session, model, "incident_opened", "incident:1", {})
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(AlertLog)) == 1


async def test_rollup_idempotency_and_retention(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    bucket = now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    async with session_factory()() as session:
        model = await session.get(Site, site["id"])
        session.add_all(
            [
                Check(
                    site_id=model.id,
                    ts=bucket + timedelta(seconds=i * 60),
                    ok=True,
                    total_ms=float(100 + i),
                )
                for i in range(5)
            ]
        )
        await session.flush()
        await build_bucket(session, model, bucket, "hour")
        await session.flush()
        await build_bucket(session, model, bucket, "hour")
        await session.commit()
        rows = list(await session.scalars(select(Rollup).where(Rollup.resolution == "hour")))
        assert len(rows) == 1
        assert len(rows[0].data["latencies"]) == 5
    await maintain()


async def test_demo_is_read_only_and_can_run_controlled_chaos(client):
    response = await client.post("/api/auth/demo")
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    response = await client.post("/api/demo/start", headers=headers)
    assert response.status_code == 200
    assert (
        await client.post(
            "/api/sites", headers=headers, json={"name": "No", "url": "https://example.com"}
        )
    ).status_code == 403


async def test_cron_secret_and_health(client):
    assert (await client.post("/api/cron/tick")).status_code == 403
    assert (await client.get("/healthz")).status_code == 200


async def test_deleting_site_discards_pending_beacons(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    data = {
        "key": site["site_key"],
        "events": [{"event_type": "pageview", "session": "pending-session"}],
    }
    assert (
        await client.post("/ingest", json=data, headers={"Origin": "https://example.com"})
    ).status_code == 202
    assert (await client.delete(f"/api/sites/{site['id']}", headers=account)).status_code == 204
    await flush()
    from app.services.ingest import active, buffer

    assert not buffer and site["id"] not in active


async def test_alert_cooldown_defers_recovery_without_dropping_it(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    from app.services.alerts import deliver_pending

    async with session_factory()() as session:
        model = await session.get(Site, site["id"])
        channel = AlertChannel(site_id=model.id, target="https://example.com/hook", cooldown_s=60)
        session.add(channel)
        await session.flush()
        await enqueue(session, model, "incident_opened", "incident:opened", {})
        await enqueue(session, model, "incident_resolved", "incident:resolved", {})
        await session.commit()
    transport = AsyncMock(return_value=ProbeResult(ok=True, status_code=200))
    monkeypatch.setattr("app.services.alerts.request", transport)
    await deliver_pending()
    assert transport.await_count == 1
    async with session_factory()() as session:
        channel = await session.scalar(select(AlertChannel))
        channel.last_sent = now() - timedelta(seconds=61)
        await session.commit()
    await deliver_pending()
    assert transport.await_count == 2
    async with session_factory()() as session:
        assert list(await session.scalars(select(AlertLog.status))) == ["sent", "sent"]


async def test_chunked_auth_body_limit(client):
    async def chunks():
        yield b"x" * 10000
        yield b"x" * 10000

    assert (
        await client.post(
            "/api/auth/login", content=chunks(), headers={"Content-Type": "application/json"}
        )
    ).status_code == 413


async def test_storage_pressure_pauses_ingestion(client, account, monkeypatch):
    from app.models import ServiceState

    site = await create(client, account, monkeypatch)
    async with session_factory()() as session:
        session.add(ServiceState(key="storage_pressure", value="1"))
        await session.commit()
    response = await client.post(
        "/ingest",
        headers={"Origin": "https://example.com"},
        json={
            "key": site["site_key"],
            "events": [{"event_type": "pageview", "session": "pressure-session"}],
        },
    )
    assert response.status_code == 429
    async with session_factory()() as session:
        assert (await session.get(Site, site["id"])).events_today == 0


async def test_retention_bounds_demo_and_expired_unrolled_rum(client, account, monkeypatch):
    site = await create(client, account, monkeypatch)
    async with session_factory()() as session:
        model = await session.get(Site, site["id"])
        model.demo = True
        session.add(Check(site_id=model.id, ts=now() - timedelta(days=8), ok=True))
        session.add(
            RumEvent(
                site_id=model.id,
                ts=now() - timedelta(hours=49),
                event_type="pageview",
                visitor_hash="h",
                session_hash="s",
                device="desktop",
                tz="UTC",
                path="/",
            )
        )
        await session.commit()
    await maintain()
    async with session_factory()() as session:
        assert await session.scalar(select(func.count()).select_from(Check)) == 0
        assert await session.scalar(select(func.count()).select_from(RumEvent)) == 0


async def test_telegram_alert_payload_and_secret_redaction(client, account, monkeypatch):
    import json

    from app.services.alerts import deliver_pending

    site = await create(client, account, monkeypatch)
    response = await client.post(
        f"/api/sites/{site['id']}/alerts",
        headers=account,
        json={
            "type": "telegram",
            "target": "https://api.telegram.org/bot123:fake_token/sendMessage",
            "chat_id": "-100123456",
        },
    )
    assert response.status_code == 201 and "fake_token" not in response.text
    async with session_factory()() as session:
        model = await session.get(Site, site["id"])
        await enqueue(session, model, "incident_opened", "telegram:1", {})
        await session.commit()
    transport = AsyncMock(return_value=ProbeResult(ok=True, status_code=200))
    monkeypatch.setattr("app.services.alerts.request", transport)
    await deliver_pending()
    target, method, body = transport.call_args.args
    assert method == "POST" and target.startswith("https://api.telegram.org/")
    assert json.loads(body)["chat_id"] == "-100123456"
    assert "incident_opened" in json.loads(body)["text"]
    response = await client.post(
        f"/api/sites/{site['id']}/alerts",
        headers=account,
        json={"type": "telegram", "target": "https://example.com/not-telegram", "chat_id": "1"},
    )
    assert response.status_code == 422
