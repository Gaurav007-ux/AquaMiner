"""AquaYantra — SensorReading schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from app.schemas.common import OrmBase


class ReadingResponse(OrmBase):
    id: uuid.UUID
    device_id: uuid.UUID
    deployment_id: uuid.UUID | None
    timestamp: datetime
    sequence: int | None

    latitude: float | None
    longitude: float | None
    depth: float | None

    magnetometer_x: float | None
    magnetometer_y: float | None
    magnetometer_z: float | None
    magnetic_magnitude: float | None
    magnetic_baseline: float | None
    magnetic_deviation: float | None

    anomaly_score: float | None
    detection_confidence: float | None

    turbidity: float | None
    pressure: float | None
    battery_voltage: float | None
    battery_percent: float | None

    sensor_health: str | None
    data_quality: float | None


class ReadingCompactResponse(OrmBase):
    """Lightweight response for list/batch endpoints."""
    id: uuid.UUID
    timestamp: datetime
    magnetic_magnitude: float | None
    anomaly_score: float | None
    detection_confidence: float | None
    latitude: float | None
    longitude: float | None
    depth: float | None
    data_quality: float | None
