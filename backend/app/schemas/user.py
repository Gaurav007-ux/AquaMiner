"""AquaYantra — User schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import OrmBase


class UserCreate(OrmBase):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: str = "viewer"


class UserUpdate(OrmBase):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserResponse(OrmBase):
    id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
