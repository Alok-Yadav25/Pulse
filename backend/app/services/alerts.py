"""Persistent grouped webhook outbox, cooldowns, and bounded retries."""

import json
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import session_factory
from app.models import AlertChannel, AlertLog, Site, now
from app.services.probe import request


async def enqueue(
    session: AsyncSession, site: Site, event: str, group_key: str, details: dict
) -> None:
    """Group by incident/certificate threshold and avoid repeated check notifications."""
    channels = list(
        await session.scalars(
            select(AlertChannel).where(
                AlertChannel.site_id == site.id, AlertChannel.enabled.is_(True)
            )
        )
    )
    for channel in channels:
        previous = await session.scalar(
            select(AlertLog).where(
                AlertLog.channel_id == channel.id, AlertLog.group_key == group_key
            )
        )
        if not previous:
            session.add(
                AlertLog(
                    site_id=site.id,
                    channel_id=channel.id,
                    group_key=group_key,
                    payload={
                        "event": event,
                        "site": site.name,
                        "site_id": site.id,
                        "details": details,
                    },
                )
            )


async def deliver_pending() -> None:
    """Deliver after cooldown; failed requests retry up to three times, without redirects."""
    async with session_factory()() as session:
        deliveries = list(
            await session.scalars(
                select(AlertLog)
                .where(AlertLog.status.in_(["pending", "retry"]), AlertLog.attempts < 3)
                .order_by(AlertLog.ts)
                .limit(10)
            )
        )
        for delivery in deliveries:
            channel = await session.get(AlertChannel, delivery.channel_id)
            if not channel or not channel.enabled:
                delivery.status = "cancelled"
                continue
            if channel.last_sent and now() < channel.last_sent + timedelta(
                seconds=channel.cooldown_s
            ):
                continue
            text = (
                f"Pulse · {delivery.payload['site']} · {delivery.payload['event']}\n"
                f"{json.dumps(delivery.payload['details'])}"
            )
            payload = (
                {"content": text}
                if channel.type == "discord"
                else {"text": text}
                if channel.type == "slack"
                else {
                    "text": text,
                    "chat_id": parse_qs(urlsplit(channel.target).query)["chat_id"][0],
                }
                if channel.type == "telegram"
                else delivery.payload
            )
            result = await request(channel.target, "POST", json.dumps(payload).encode())
            delivery.attempts += 1
            delivery.status = (
                "sent" if result.ok else "failed" if delivery.attempts >= 3 else "retry"
            )
            channel.last_sent = now()
        await session.commit()
