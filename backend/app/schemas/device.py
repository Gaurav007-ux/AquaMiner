"""AquaYantra — Device & Sensor schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import OrmBase


# ── Device ───────────────────────────────────────────────────────

class DeviceCreate(OrmBase):
    device_serial: str = Field(max_length=100)
    name: str = Field(max_length=255)
    firmware_version: str | None = None
    hardware_version: str | None = None
    description: str | None = None


class DeviceUpdate(OrmBase):
    name: str | None = None
    firmware_version: str | None = None
    hardware_version: str | None = None
    description: str | None = None
    status: str | None = None


class DeviceResponse(OrmBase):
    id: uuid.UUID
    device_serial: str
    name: str
    firmware_version: str | None
    hardware_version: str | None
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    sensors: list[SensorResponse] = []


# ── Sensor ───────────────────────────────────────────────────────

class SensorCreate(OrmBase):
    device_id: uuid.UUID
    sensor_type: str
    model: str | None = None
    serial_number: str | None = None
    configuration: dict[str, Any] | None = None


class SensorResponse(OrmBase):
    id: uuid.UUID
    device_id: uuid.UUID
    sensor_type: str
    model: str | None
    serial_number: str | None
    configuration: dict[str, Any] | None
    status: str
    calibration_version: int


# Rebuild DeviceResponse to resolve forward ref
DeviceResponse.model_rebuild()
