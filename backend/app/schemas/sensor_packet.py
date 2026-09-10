"""AquaYantra — Normalized SensorPacket schema for ingestion.

This is the universal internal representation for data arriving from any
transport layer (HTTP, WebSocket, serial gateway, LoRa gateway).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.config import settings


class SensorPacket(BaseModel):
    """
    Normalized sensor data packet from the device.

    Every ingestion adapter must convert its transport-specific format
    into this schema before passing data to the processing pipeline.
    """

    device_id: str = Field(description="Unique device identifier, e.g. AQUAYANTRA-001")
    timestamp: datetime = Field(description="UTC timestamp of measurement")
    sequence: int | None = Field(None, description="Monotonic packet sequence number")

    # Magnetometer (µT)
    mag_x: float | None = Field(None, description="Magnetometer X axis (µT)")
    mag_y: float | None = Field(None, description="Magnetometer Y axis (µT)")
    mag_z: float | None = Field(None, description="Magnetometer Z axis (µT)")

    # Environmental
    turbidity: float | None = Field(None, description="Turbidity (NTU)")
    pressure: float | None = Field(None, description="Pressure (hPa)")
    temperature: float | None = Field(None, description="Temperature (°C)")

    # Position (GPS — may arrive from surface module)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    depth: float | None = Field(None, description="Depth (meters)")

    # Battery
    battery_voltage: float | None = Field(None, description="Battery voltage (V)")
    battery_percent: float | None = Field(None, description="Battery SoC (%)", ge=0, le=100)

    # Deployment context (optional — may be set server-side)
    deployment_id: str | None = None

    # Extra / future sensor data
    extra: dict[str, Any] | None = None

    @field_validator("mag_x", "mag_y", "mag_z")
    @classmethod
    def validate_mag_range(cls, v: float | None) -> float | None:
        if v is not None and not (settings.MAG_RANGE_MIN <= v <= settings.MAG_RANGE_MAX):
            raise ValueError(
                f"Magnetometer value {v} outside allowed range "
                f"[{settings.MAG_RANGE_MIN}, {settings.MAG_RANGE_MAX}]"
            )
        return v

    @field_validator("turbidity")
    @classmethod
    def validate_turbidity_range(cls, v: float | None) -> float | None:
        if v is not None and not (settings.TURBIDITY_RANGE_MIN <= v <= settings.TURBIDITY_RANGE_MAX):
            raise ValueError(f"Turbidity value {v} outside allowed range")
        return v

    @field_validator("battery_voltage")
    @classmethod
    def validate_battery_voltage(cls, v: float | None) -> float | None:
        if v is not None and not (settings.BATTERY_VOLTAGE_MIN <= v <= settings.BATTERY_VOLTAGE_MAX):
            raise ValueError(f"Battery voltage {v} outside allowed range")
        return v


class BatchSensorPacket(BaseModel):
    """Batch of sensor packets for bulk ingestion."""
    packets: list[SensorPacket] = Field(min_length=1, max_length=1000)
