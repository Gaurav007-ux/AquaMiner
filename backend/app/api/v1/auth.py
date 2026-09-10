"""AquaYantra — Auth API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.auth import AuthService

router = APIRouter()


@router.post("/register", response_model=dict, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_session)):
    svc = AuthService(db)
    user = await svc.register(body.email, body.password, body.full_name, body.role)
    return {"id": str(user.id), "email": user.email, "role": user.role}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_session)):
    svc = AuthService(db)
    return await svc.login(body.email, body.password)
