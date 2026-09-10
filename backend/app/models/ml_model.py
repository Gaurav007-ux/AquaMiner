"""AquaYantra — MLModel and Prediction ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MLModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ml_models"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    model_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # isolation_forest, statistical, xgboost
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Feature schema version and definition
    feature_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    feature_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Training metadata
    training_samples: Mapped[int | None] = mapped_column(Integer, nullable=True)
    training_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dataset_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parameters: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Evaluation metrics
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # File storage
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status: training, validating, active, retired, failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="training", index=True)

    def __repr__(self) -> str:
        return f"<MLModel {self.name} v{self.version} ({self.status})>"


class Prediction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "predictions"

    deployment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ml_models.id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    prediction: Mapped[str] = mapped_column(String(100), nullable=False)  # BACKGROUND, POTENTIAL_TARGET, etc.
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    feature_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<Prediction {self.prediction} score={self.anomaly_score}>"
