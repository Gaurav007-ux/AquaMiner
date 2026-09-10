"""AquaYantra — SystemLog ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin


class SystemLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "system_logs"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    level: Mapped[str] = mapped_column(String(20), nullable=False, default="INFO")
    component: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    __table_args__ = (
        Index("ix_syslog_timestamp", "timestamp"),
        Index("ix_syslog_level", "level"),
    )

    def __repr__(self) -> str:
        return f"<SystemLog [{self.level}] {self.component}: {self.message[:50]}>"
