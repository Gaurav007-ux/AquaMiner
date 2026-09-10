"""AquaYantra — Device and Sensor ORM models."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Device(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "devices"

    device_serial: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    firmware_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hardware_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")

    # Relationships
    sensors: Mapped[list[Sensor]] = relationship("Sensor", back_populates="device", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Device {self.device_serial} ({self.name})>"


class Sensor(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "sensors"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sensor_type: Mapped[str] = mapped_column(String(100), nullable=False)  # magnetometer, turbidity, pressure, gps
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)  # QMC5883L, etc.
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    configuration: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    calibration_version: Mapped[int] = mapped_column(default=0, nullable=False)
    created_at: Mapped[str] = mapped_column(
        String, server_default="now()", nullable=False
    )

    # Relationships
    device: Mapped[Device] = relationship("Device", back_populates="sensors")

    def __repr__(self) -> str:
        return f"<Sensor {self.sensor_type} on {self.device_id}>"
