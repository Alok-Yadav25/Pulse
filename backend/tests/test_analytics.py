"""Availability math, outlier gating, incident transitions, and bounded queues."""

from datetime import timedelta

import pytest

from app.models import Check, now
from app.services.analytics import anomaly, availability, percentiles
from app.services.broker import Broker
from app.services.incidents import transition


def test_confirmed_failure_and_recovery() -> None:
    status, failures, successes, event = "operational", 0, 0, None
    for index in range(3):
        status, failures, successes, event = transition(status, failures, successes, False)
        assert (event == "incident_opened") == (index == 2)
    assert status == "down"
    status, failures, successes, event = transition(status, failures, successes, True)
    assert status == "down" and event is None
    status, _, _, event = transition(status, failures, successes, True)
    assert status == "operational" and event == "incident_resolved"


def test_coverage_gaps_are_not_site_downtime() -> None:
    start = now() - timedelta(minutes=10)
    checks = [
        Check(ts=start, ok=True, maintenance=False),
        Check(ts=start + timedelta(minutes=9), ok=False, maintenance=False),
    ]
    data = availability(
        checks,
        start,
        start + timedelta(minutes=10),
        60,
        [(start + timedelta(minutes=1), start + timedelta(minutes=9))],
    )
    assert data["uptime"] == 50
    assert data["coverage"] == 100
    assert data["observed_s"] == 120
    assert data["excluded_s"] == 480


def test_overlapping_maintenance_not_double_subtracted() -> None:
    start = now()
    data = availability(
        [Check(ts=start, ok=True, maintenance=False)],
        start,
        start + timedelta(seconds=60),
        60,
        [
            (start, start + timedelta(seconds=20)),
            (start + timedelta(seconds=10), start + timedelta(seconds=30)),
        ],
    )
    assert data["observed_s"] == 30
    assert data["excluded_s"] == 30
    assert data["uptime"] == 100
    assert availability([], start, start + timedelta(seconds=60), 60, [])["uptime"] is None


def test_percentiles_and_anomaly_gate() -> None:
    data = percentiles([100, 200, 300, 1000, 3000])
    assert data["p50"] == 300
    assert data["apdex"] == 0.7
    assert percentiles([])["p95"] is None
    assert anomaly([100] * 15 + [500, 500]) is None
    assert anomaly([100] * 15 + [500] * 3) is not None


def test_broker_disconnects_slow_clients_and_caps_connections() -> None:
    broker = Broker()
    queue = broker.subscribe("a")
    for _ in range(65):
        broker.publish("a", "check", {})
    assert queue.get_nowait() is None
    assert "a" not in broker.clients
    for i in range(50):
        broker.subscribe(str(i))
    with pytest.raises(OverflowError):
        broker.subscribe("too-many")
