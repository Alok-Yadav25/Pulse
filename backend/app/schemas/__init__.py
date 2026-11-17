"""Bounded request contracts shared by HTTP routes and tests."""

import re
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class Assertions(BaseModel):
    status_codes: list[int] = Field(default_factory=list, max_length=10)
    contains: str = Field(default="", max_length=500)
    json_path: str = Field(default="", max_length=200, pattern=r"^[\w.\-]*$")
    equals: str | float | bool | None = None
    max_ms: int = Field(default=10000, ge=100, le=10000)

    @field_validator("status_codes")
    @classmethod
    def statuses(cls, values: list[int]) -> list[int]:
        if any(not 100 <= value <= 599 for value in values):
            raise ValueError("Status codes must be between 100 and 599")
        return values


class SiteInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    url: str = Field(min_length=8, max_length=2048)
    interval_s: int = Field(default=60, ge=30, le=3600)
    public_status: bool = False
    group: str = Field(default="Production", max_length=40)
    tags: list[str] = Field(default_factory=list, max_length=8)
    assertions: Assertions = Field(default_factory=Assertions)

    @field_validator("name", "group")
    @classmethod
    def trimmed(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank")
        return value.strip()

    @field_validator("tags")
    @classmethod
    def tag_limits(cls, values: list[str]) -> list[str]:
        if any(not 1 <= len(value.strip()) <= 24 for value in values):
            raise ValueError("Tags must have 1–24 characters")
        return list(dict.fromkeys(value.strip() for value in values))


class MaintenanceInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def valid_period(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Maintenance times must include a timezone")
        if not timedelta(0) < self.ends_at - self.starts_at <= timedelta(days=7):
            raise ValueError("Maintenance must last at most seven days and end after it starts")
        return self


class DeploymentInput(BaseModel):
    version: str = Field(min_length=1, max_length=100)
    notes: str = Field(default="", max_length=1000)


class AlertInput(BaseModel):
    type: Literal["webhook", "discord", "slack", "telegram"] = "webhook"
    target: str = Field(max_length=2048)
    chat_id: str = Field(default="", max_length=100)
    enabled: bool = True
    cooldown_s: int = Field(default=300, ge=60, le=86400)

    @model_validator(mode="after")
    def telegram_destination(self):
        if self.type == "telegram":
            parsed = urlsplit(self.target)
            if (
                parsed.scheme != "https"
                or parsed.hostname != "api.telegram.org"
                or not re.fullmatch(r"/bot[0-9]+:[A-Za-z0-9_-]+/sendMessage", parsed.path)
                or parsed.query
                or parsed.fragment
                or not re.fullmatch(r"-?[0-9]+|@[A-Za-z0-9_]+", self.chat_id)
            ):
                raise ValueError("Use a Telegram Bot API sendMessage URL and a valid chat ID")
        return self


class EventInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_type: Literal["pageview", "vitals", "heartbeat"]
    session: str = Field(min_length=8, max_length=80)
    view: str = Field(default="legacy", max_length=80)
    path: str = Field(default="/", max_length=512)
    referrer_host: str = Field(default="", max_length=253)
    device: Literal["mobile", "tablet", "desktop"] = "desktop"
    tz: str = Field(default="", max_length=80, pattern=r"^[A-Za-z0-9_+\-/]*$")
    timings: dict[str, float] = Field(default_factory=dict, max_length=8)

    @field_validator("path")
    @classmethod
    def private_path(cls, value: str) -> str:
        if not value.startswith("/") or value.startswith("//"):
            raise ValueError("Only relative page paths are accepted")
        return (
            value.split("?", 1)[0].split("#", 1)[0].encode("utf-8")[:128].decode("utf-8", "ignore")
        )

    @field_validator("referrer_host")
    @classmethod
    def referrer_only(cls, value: str) -> str:
        if value and not re.fullmatch(r"[a-zA-Z0-9.\-\[\]:]+", value):
            raise ValueError("Referrer must contain only a host")
        return value

    @field_validator("timings")
    @classmethod
    def bounded_timings(cls, values: dict[str, float]) -> dict[str, float]:
        allowed = {"ttfb_ms", "dcl_ms", "load_ms", "lcp_ms", "cls", "inp_ms"}
        return {
            key: value
            for key, value in values.items()
            if key in allowed and 0 <= value <= (10 if key == "cls" else 120000)
        }


class BeaconInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str = Field(min_length=16, max_length=64)
    events: list[EventInput] = Field(min_length=1, max_length=10)
