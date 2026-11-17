"""Durable entities. All times are UTC; no model stores an IP address."""

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def now() -> datetime:
    """Return an aware UTC timestamp."""
    return datetime.now(UTC)


def identity() -> str:
    """Return an opaque record ID."""
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Site(Base):
    __tablename__ = "sites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    url: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    site_key: Mapped[str] = mapped_column(
        String(64), unique=True, default=lambda: secrets.token_urlsafe(24)
    )
    interval_s: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_check_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )
    failures: Mapped[int] = mapped_column(Integer, default=0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    public_status: Mapped[bool] = mapped_column(Boolean, default=False)
    group: Mapped[str] = mapped_column(String(40), default="Production")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    assertions: Mapped[dict] = mapped_column(JSON, default=dict)
    events_date: Mapped[str] = mapped_column(String(10), default="")
    events_today: Mapped[int] = mapped_column(Integer, default=0)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Check(Base):
    __tablename__ = "checks"
    __table_args__ = (Index("ix_checks_site_ts", "site_id", "ts"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ok: Mapped[bool] = mapped_column(Boolean)
    status_code: Mapped[int | None] = mapped_column(Integer)
    dns_ms: Mapped[float] = mapped_column(Float, default=0)
    tcp_ms: Mapped[float] = mapped_column(Float, default=0)
    tls_ms: Mapped[float] = mapped_column(Float, default=0)
    ttfb_ms: Mapped[float] = mapped_column(Float, default=0)
    total_ms: Mapped[float] = mapped_column(Float, default=0)
    bytes: Mapped[int] = mapped_column(Integer, default=0)
    redirects: Mapped[int] = mapped_column(Integer, default=0)
    error_type: Mapped[str | None] = mapped_column(String(60))
    tls_days_left: Mapped[int | None] = mapped_column(Integer)
    maintenance: Mapped[bool] = mapped_column(Boolean, default=False)


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (Index("ix_incidents_site_ts", "site_id", "started_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cause: Mapped[str] = mapped_column(String(100))
    peak_latency_ms: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")


class RumEvent(Base):
    __tablename__ = "rum_events"
    __table_args__ = (Index("ix_rum_site_ts", "site_id", "ts"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    event_type: Mapped[str] = mapped_column(String(20))
    visitor_hash: Mapped[str] = mapped_column(String(64))
    session_hash: Mapped[str] = mapped_column(String(64))
    path: Mapped[str] = mapped_column(String(512))
    referrer_host: Mapped[str] = mapped_column(String(253), default="")
    device: Mapped[str] = mapped_column(String(12))
    tz: Mapped[str] = mapped_column(String(80))
    timings: Mapped[dict] = mapped_column(JSON, default=dict)


class Maintenance(Base):
    __tablename__ = "maintenance_windows"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(100))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Deployment(Base):
    __tablename__ = "deployments"
    __table_args__ = (Index("ix_deployments_site_ts", "site_id", "ts"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    version: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str] = mapped_column(String(1000), default="")


class AlertChannel(Base):
    __tablename__ = "alert_channels"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(20), default="webhook")
    target: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cooldown_s: Mapped[int] = mapped_column(Integer, default=300)
    last_sent: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AlertLog(Base):
    __tablename__ = "alert_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    channel_id: Mapped[str] = mapped_column(ForeignKey("alert_channels.id", ondelete="CASCADE"))
    group_key: Mapped[str] = mapped_column(String(160))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class MonitorGap(Base):
    __tablename__ = "monitor_gaps"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(100))


class ServiceState(Base):
    __tablename__ = "service_state"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class Rollup(Base):
    __tablename__ = "rollups"
    __table_args__ = (Index("ix_rollup_unique", "site_id", "bucket", "resolution", unique=True),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identity)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    bucket: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolution: Mapped[str] = mapped_column(String(10))
    data: Mapped[dict] = mapped_column(JSON)


class SiteProfile(Base):
    __tablename__ = "site_profiles"
    site_id: Mapped[str] = mapped_column(
        ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    data: Mapped[dict] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
