"""AquaYantra — FastAPI dependency injection."""

from __future__ import annotations

from typing import Any

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserRole, get_current_user_payload, require_role
from app.database.session import get_db


async def get_session(db: AsyncSession = Depends(get_db)) -> AsyncSession:
    """Alias for DB session dependency."""
    return db


# Convenience role dependencies
require_admin = require_role(UserRole.ADMIN)
require_operator = require_role(UserRole.ADMIN, UserRole.OPERATOR)
require_viewer = require_role(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
