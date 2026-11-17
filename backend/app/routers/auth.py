"""Account creation, sign-in, and a seeded read-only demo session."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select

from app.config import get_settings
from app.db import session_factory
from app.models import User
from app.schemas import Credentials
from app.services.security import (
    current_user,
    password_hash,
    password_matches,
    rate_limit,
    token_for,
)

router = APIRouter(prefix="/api", tags=["accounts"])
registration_lock = asyncio.Lock()


def account(user: User) -> dict:
    """Never serialize password hashes to the client."""
    return {"id": user.id, "email": user.email, "demo": user.demo}


@router.post("/auth/register", status_code=201)
async def register(data: Credentials, request: Request) -> dict:
    """Create a bounded free-tier account and return its short-lived session."""
    rate_limit(request, "auth", 10)
    async with registration_lock, session_factory()() as session:
        if await session.scalar(select(User.id).where(User.email == data.email)):
            raise HTTPException(409, "An account already exists for this email")
        if (
            await session.scalar(select(func.count()).select_from(User).where(User.demo.is_(False)))
            or 0
        ) >= get_settings().max_users:
            raise HTTPException(409, "This deployment has reached its account limit")
        user = User(email=data.email, password_hash=await password_hash(data.password))
        session.add(user)
        await session.flush()
        token = token_for(user)
        await session.commit()
        return {"access_token": token, "user": account(user)}


@router.post("/auth/login")
async def login(data: Credentials, request: Request) -> dict:
    """Verify a password without blocking the event loop."""
    rate_limit(request, "auth", 10)
    async with session_factory()() as session:
        user = await session.scalar(
            select(User).where(User.email == data.email, User.demo.is_(False))
        )
        valid = await password_matches(user.password_hash if user else "$invalid", data.password)
        if not user or not valid:
            raise HTTPException(401, "Email or password is incorrect")
        return {"access_token": token_for(user), "user": account(user)}


@router.post("/auth/demo")
async def demo(request: Request) -> dict:
    """Return the pre-seeded read-only account; never allow arbitrary demo writes."""
    rate_limit(request, "demo-auth", 20)
    if not get_settings().demo_enabled:
        raise HTTPException(404, "Demo is disabled")
    async with registration_lock, session_factory()() as session:
        user = await session.scalar(select(User).where(User.demo.is_(True)))
        if not user:
            user = User(email="demo@pulse.local", password_hash="disabled", demo=True)
            session.add(user)
            await session.commit()
        return {"access_token": token_for(user), "user": account(user)}


@router.get("/me")
async def me(user: User = Depends(current_user)) -> dict:
    """Return the authenticated account's non-sensitive public fields."""
    return account(user)
