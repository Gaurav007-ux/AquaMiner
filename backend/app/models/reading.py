"""AquaYantra — SensorReading ORM model (high-volume table)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin


class SensorReading(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "sensor_readings"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    deployment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Position
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Magnetometer raw
    magnetometer_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnetometer_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnetometer_z: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Magnetometer derived
    magnetic_magnitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnetic_baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnetic_deviation: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Detection
    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    detection_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Environmental
    turbidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Battery
    battery_voltage: Mapped[float | None] = mapped_column(Float, nullable=True)
    battery_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Quality
    sensor_health: Mapped[str | None] = mapped_column(String(50), nullable=True)
    data_quality: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Raw payload for audit
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_readings_device_ts", "device_id", "timestamp"),
        Index("ix_readings_deployment_ts", "deployment_id", "timestamp"),
        Index("ix_readings_anomaly", "anomaly_score"),
        Index("ix_readings_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<SensorReading device={self.device_id} ts={self.timestamp}>"
