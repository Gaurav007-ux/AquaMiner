"""AquaYantra — Common / shared Pydantic schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class OrmBase(BaseModel):
    """Base for schemas that map to ORM models."""
    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    """Query parameters for paginated list endpoints."""
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Envelope for paginated list responses."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: str = "OK"


class TimestampRange(BaseModel):
    """Filter for timestamp ranges."""
    start: datetime | None = None
    end: datetime | None = None


class IDResponse(BaseModel):
    """Response returning a created resource ID."""
    id: uuid.UUID
