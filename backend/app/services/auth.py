"""
AquaYantra — Authentication service.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.repositories import UserRepository


class AuthService:
    """Handles user registration and authentication."""

    def __init__(self, session: AsyncSession) -> None:
        self._repo = UserRepository(session)

    async def register(
        self,
        email: str,
        password: str,
        full_name: str | None = None,
        role: str = "viewer",
    ) -> User:
        existing = await self._repo.get_by_email(email)
        if existing:
            raise ConflictError(f"User with email '{email}' already exists")

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
        )
        return await self._repo.create(user)

    async def login(self, email: str, password: str) -> dict:
        user = await self._repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        from app.core.config import settings

        access = create_access_token(str(user.id), user.role)
        refresh = create_refresh_token(str(user.id))
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
