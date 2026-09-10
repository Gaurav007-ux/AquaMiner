"""AquaYantra — DetectionEvent ORM model."""

from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin


class DetectionEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "detection_events"

    deployment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # PostGIS location
    location = mapped_column(Geography("POINT", srid=4326), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Detection metrics
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    peak_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    mean_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ML
    feature_vector: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    classification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Status: detected, confirmed, dismissed, requires_investigation
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="detected")

    __table_args__ = (
        Index("ix_detection_deployment", "deployment_id"),
        Index("ix_detection_timestamp", "timestamp"),
        Index("ix_detection_location", "location", postgresql_using="gist"),
        Index("ix_detection_score", "anomaly_score"),
    )

    def __repr__(self) -> str:
        return f"<DetectionEvent score={self.anomaly_score} conf={self.confidence}>"
