"""AquaYantra — CalibrationProfile ORM model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CalibrationProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "calibration_profiles"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sensor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sensors.id", ondelete="SET NULL"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Hard-iron offsets (µT)
    hard_iron_offset_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hard_iron_offset_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hard_iron_offset_z: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Soft-iron 3x3 correction matrix (stored as JSON array of arrays)
    soft_iron_matrix: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Axis scale factors
    axis_scale_x: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    axis_scale_y: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    axis_scale_z: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    # Axis alignment correction (JSON)
    axis_alignment: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Baseline and noise
    baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    noise_level: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Temperature compensation parameters (JSON)
    temperature_compensation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Quality
    calibration_quality: Mapped[float | None] = mapped_column(Float, nullable=True)
    calibration_status: Mapped[str] = mapped_column(String(50), nullable=False, default="uncalibrated")
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Activation flag
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    def __repr__(self) -> str:
        return f"<CalibrationProfile v{self.version} device={self.device_id} active={self.active}>"
