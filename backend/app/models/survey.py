"""AquaYantra — SurveyPoint ORM model with PostGIS geometry."""

from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin


class SurveyPoint(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "survey_points"

    deployment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    depth: Mapped[float | None] = mapped_column(Float, nullable=True)

    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    environmental_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # PostGIS Point geometry
    geometry = mapped_column(Geography("POINT", srid=4326), nullable=False)

    __table_args__ = (
        Index("ix_survey_deployment", "deployment_id"),
        Index("ix_survey_anomaly", "anomaly_score"),
        Index("ix_survey_geom", "geometry", postgresql_using="gist"),
    )

    def __repr__(self) -> str:
        return f"<SurveyPoint ({self.latitude}, {self.longitude}) anomaly={self.anomaly_score}>"
