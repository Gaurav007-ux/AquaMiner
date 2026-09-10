"""AquaYantra — Mission & Deployment schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import OrmBase


# ── Mission ──────────────────────────────────────────────────────

class MissionCreate(OrmBase):
    name: str = Field(max_length=255)
    description: str | None = None
    operator: str | None = None


class MissionUpdate(OrmBase):
    name: str | None = None
    description: str | None = None
    operator: str | None = None
    status: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None


class MissionResponse(OrmBase):
    id: uuid.UUID
    name: str
    description: str | None
    operator: str | None
    status: str
    start_time: datetime | None
    end_time: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Deployment ───────────────────────────────────────────────────

class DeploymentCreate(OrmBase):
    mission_id: uuid.UUID
    device_id: uuid.UUID
    deployment_number: int = 1
    start_latitude: float | None = None
    start_longitude: float | None = None


class DeploymentUpdate(OrmBase):
    status: str | None = None
    end_time: datetime | None = None
    end_latitude: float | None = None
    end_longitude: float | None = None
    maximum_depth: float | None = None


class DeploymentResponse(OrmBase):
    id: uuid.UUID
    mission_id: uuid.UUID
    device_id: uuid.UUID
    deployment_number: int
    status: str
    start_time: datetime | None
    end_time: datetime | None
    maximum_depth: float | None
    created_at: datetime
    updated_at: datetime
