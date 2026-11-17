"""Isolated test defaults; integration tests require a separately named Postgres DB."""

import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-which-is-at-least-32-characters")
os.environ.setdefault("SALT_SECRET", "test-salt-secret-which-is-at-least-32-characters")
os.environ.setdefault("CRON_SECRET", "test-cron-secret-which-is-at-least-32-characters")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
