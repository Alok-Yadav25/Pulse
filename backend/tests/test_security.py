"""Adversarial URL, payload, and authentication boundary tests."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.schemas import EventInput, MaintenanceInput
from app.services.probe import assert_response
from app.services.security import RateLimiter, password_hash, password_matches
from app.services.ssrf import UnsafeURL, normalize_url, public_ip, resolve_target


@pytest.mark.parametrize(
    "address",
    [
        "0.0.0.0",
        "0.0.0.1",
        "127.0.0.1",
        "127.255.255.255",
        "10.0.0.1",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "192.168.255.255",
        "169.254.169.254",
        "169.254.0.1",
        "100.64.0.1",
        "100.127.255.254",
        "224.0.0.1",
        "239.255.255.255",
        "240.0.0.1",
        "255.255.255.255",
        "192.0.2.1",
        "198.51.100.1",
        "203.0.113.1",
        "198.18.0.1",
        "198.19.255.255",
        "::",
        "::1",
        "fc00::1",
        "fd00::1",
        "fe80::1",
        "ff02::1",
        "2001:db8::1",
        "::ffff:127.0.0.1",
        "::ffff:10.0.0.1",
        "::ffff:169.254.169.254",
        "2002:7f00:1::",
        "2001::1",
    ],
)
def test_unsafe_addresses(address: str) -> None:
    assert not public_ip(address)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com",
        "https://user:pass@example.com",
        "https://user@example.com",
        "http://example.com:22",
        "http://example.com:5432",
        "https://localhost",
        "http://metadata.google.internal",
        "https://example.com\\@127.0.0.1",
        "https://example.com\n.evil.com",
        "https://%31%32%37.0.0.1",
        "https://example.com/%0d\n",
        "http://[fe80::1%25en0]",
    ],
)
def test_url_tricks(url: str) -> None:
    with pytest.raises(UnsafeURL):
        normalize_url(url)


@pytest.mark.parametrize(
    "host", ["2130706433", "0177.0.0.1", "0x7f000001", "127.1", "[::ffff:127.0.0.1]"]
)
async def test_obscure_loopback_forms(host: str) -> None:
    with pytest.raises(UnsafeURL):
        await resolve_target(f"http://{host}/")


async def test_rejects_mixed_public_private_dns(monkeypatch) -> None:
    loop = asyncio.get_running_loop()
    resolver = AsyncMock(
        return_value=[(2, 1, 6, "", ("1.1.1.1", 443)), (2, 1, 6, "", ("10.1.2.3", 443))]
    )
    monkeypatch.setattr(loop, "getaddrinfo", resolver)
    with pytest.raises(UnsafeURL):
        await resolve_target("https://safe-looking.example/health")


async def test_valid_target_pins_ip_and_preserves_url(monkeypatch) -> None:
    monkeypatch.setattr(
        asyncio.get_running_loop(),
        "getaddrinfo",
        AsyncMock(return_value=[(2, 1, 6, "", ("1.1.1.1", 443))]),
    )
    target = await resolve_target("https://example.com:8443/health?region=in#fragment")
    assert target.ip == "1.1.1.1"
    assert target.host == "example.com"
    assert target.path == "/health?region=in"
    assert target.url == "https://example.com:8443/health?region=in"


def test_response_assertions() -> None:
    assert (
        assert_response(200, b'{"ok":true,"data":[4]}', {"status_codes": [201]})
        == "assertion_status"
    )
    assert assert_response(200, b"hello", {"contains": "ready"}) == "assertion_text"
    assert assert_response(200, b'{"ok":true}', {"json_path": "ok", "equals": True}) is None
    assert assert_response(200, b'{"data":[4]}', {"json_path": "data.0", "equals": 4}) is None
    assert (
        assert_response(200, b"not json", {"json_path": "ok", "equals": True}) == "assertion_json"
    )


def test_ingestion_strips_queries_and_unknown_fields() -> None:
    event = EventInput(
        event_type="pageview",
        session="abcdefgh",
        path="/pricing?email=private#top",
        raw_ip="never-store",
        timings={"load_ms": 450, "unknown": 1, "cls": float("nan")},
    )
    assert event.path == "/pricing"
    assert event.timings == {"load_ms": 450}
    assert "raw_ip" not in event.model_dump()
    with pytest.raises(ValidationError):
        EventInput(
            event_type="pageview", session="abcdefgh", referrer_host="https://example.com/private"
        )


def test_naive_maintenance_is_rejected() -> None:
    with pytest.raises(ValidationError):
        MaintenanceInput(
            title="Deploy", starts_at="2026-11-17T10:00:00", ends_at="2026-11-17T11:00:00"
        )


async def test_passwords_and_rate_limit_bounds() -> None:
    encoded = await password_hash("correct-horse-battery")
    assert await password_matches(encoded, "correct-horse-battery")
    assert not await password_matches(encoded, "wrong-password")
    limiter = RateLimiter(max_keys=2)
    assert limiter.allow("opaque-1", 1)
    assert not limiter.allow("opaque-1", 1)
    limiter.allow("opaque-2", 1)
    limiter.allow("opaque-3", 1)
    assert len(limiter.buckets) == 2
