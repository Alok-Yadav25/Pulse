"""Password hashing, expiring bearer tokens, and bounded anonymous rate limits."""

import asyncio
import hashlib
import hmac
import time
from collections import OrderedDict
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import get_settings
from app.db import session_factory
from app.models import User

hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
bearer = HTTPBearer(auto_error=False)
hash_slots = asyncio.Semaphore(2)


class BodyLimitMiddleware:
    """Buffer only a bounded request body before FastAPI parses JSON."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return
        limit = 4096 if scope.get("path") == "/ingest" else 16384
        messages = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                await JSONResponse(
                    {"detail": "Request body exceeds the endpoint limit"}, status_code=413
                )(scope, receive, send)
                return
            messages.append(message)
            if not message.get("more_body", False):
                break

        async def replay() -> Message:
            return messages.pop(0) if messages else await receive()

        await self.app(scope, replay, send)


def private_hash(value: str, purpose: str = "visitor") -> str:
    """Rotate identifiers daily and retain only the digest, never the input IP."""
    secret = get_settings().salt_secret
    if len(secret) < 32:
        raise HTTPException(503, "SALT_SECRET must be configured")
    day = datetime.now(UTC).date().isoformat()
    return hmac.new(
        secret.encode(), f"{day}:{purpose}:{value}".encode(), hashlib.sha256
    ).hexdigest()


class RateLimiter:
    """Fixed-window limiter with a hard key cap; inputs must be opaque hashes."""

    def __init__(self, max_keys: int = 10000) -> None:
        self.buckets: OrderedDict[str, tuple[int, int]] = OrderedDict()
        self.max_keys = max_keys

    def allow(self, key: str, limit: int, window: int = 60) -> bool:
        bucket = int(time.monotonic() // window)
        previous, count = self.buckets.pop(key, (bucket, 0))
        count = count + 1 if previous == bucket else 1
        self.buckets[key] = (bucket, count)
        while len(self.buckets) > self.max_keys:
            self.buckets.popitem(last=False)
        return count <= limit


limiter = RateLimiter()


def rate_limit(request: Request, scope: str, limit: int) -> None:
    """Do not trust arbitrary X-Forwarded-For headers from public requests."""
    address = request.client.host if request.client else "unknown"
    if not limiter.allow(private_hash(address, scope), limit):
        raise HTTPException(429, "Rate limit exceeded", headers={"Retry-After": "60"})


async def password_hash(password: str) -> str:
    """Keep Argon2 CPU work off the async request loop."""
    async with hash_slots:
        return await asyncio.to_thread(hasher.hash, password)


async def password_matches(encoded: str, password: str) -> bool:
    """Treat malformed password hashes as an authentication failure."""
    try:
        async with hash_slots:
            return await asyncio.to_thread(hasher.verify, encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def token_for(user: User) -> str:
    """Issue a short-lived, issuer-bound JWT with an explicit algorithm."""
    settings = get_settings()
    if len(settings.jwt_secret) < 32:
        raise HTTPException(503, "Configure JWT_SECRET with at least 32 characters")
    current = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user.id,
            "iat": current,
            "exp": current + timedelta(minutes=settings.jwt_ttl_minutes),
            "iss": "pulse",
            "aud": "pulse-dashboard",
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    """Authenticate an account; ownership is checked separately on every site route."""
    if not credentials:
        raise HTTPException(401, "Sign in to your workspace")
    try:
        data = jwt.decode(
            credentials.credentials,
            get_settings().jwt_secret,
            algorithms=["HS256"],
            issuer="pulse",
            audience="pulse-dashboard",
            options={"require": ["sub", "exp", "iat"]},
        )
    except jwt.InvalidTokenError as error:
        raise HTTPException(401, "Session expired or invalid") from error
    async with session_factory()() as session:
        user = await session.get(User, data["sub"])
        if not user:
            raise HTTPException(401, "Account no longer exists")
        return user


def writable(user: User) -> None:
    """The seeded recruiter account cannot change monitors or alert destinations."""
    if user.demo:
        raise HTTPException(403, "The demo account is read-only")
