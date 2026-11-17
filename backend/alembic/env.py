"""Run migrations through the same async driver as the API."""

import asyncio

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.config import get_settings
from app.db import Base, async_database_url

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL without connecting to Postgres."""
    context.configure(
        url=async_database_url(get_settings().database_url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def configure_connection(connection: Connection) -> None:
    """Apply revision operations inside a transaction."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Use a short-lived migration connection, never a persistent API pool."""
    engine = async_engine_from_config(
        {"sqlalchemy.url": async_database_url(get_settings().database_url)},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"statement_cache_size": 0},
    )
    async with engine.connect() as connection:
        await connection.run_sync(configure_connection)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
