"""Lazy, bounded async database plumbing for later feature phases."""

from functools import lru_cache

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """Base for models introduced alongside their feature migrations."""


def async_database_url(url: str) -> str:
    """Normalize common Postgres schemes for SQLAlchemy's asyncpg dialect."""
    parsed = make_url(url)
    if parsed.drivername in {"postgres", "postgresql"}:
        parsed = parsed.set(drivername="postgresql+asyncpg")
    query = dict(parsed.query)
    if "sslmode" in query:
        query["ssl"] = query.pop("sslmode")
    # asyncpg uses TLS but does not accept libpq's channel_binding connection option.
    query.pop("channel_binding", None)
    return parsed.set(query=query).render_as_string(hide_password=False)


@lru_cache
def get_engine() -> AsyncEngine:
    """Create the pool lazily; a health check never opens a database connection."""
    return create_async_engine(
        async_database_url(get_settings().database_url),
        pool_size=2,
        max_overflow=0,
        pool_pre_ping=True,
        pool_timeout=5,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "timeout": 5,
            "command_timeout": 10,
        },
    )


def session_factory() -> async_sessionmaker[AsyncSession]:
    """Return sessions without retaining request-scoped state in memory."""
    return async_sessionmaker(get_engine(), expire_on_commit=False)
