"""
AquaYantra — Environment-based configuration.

All settings are loaded from environment variables / .env file.
No secrets are hardcoded.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "AquaYantra"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"

    # ── Server ───────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://aquayantra:aquayantra@localhost:5432/aquayantra"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True

    # ── Security / JWT ───────────────────────────────────────────
    JWT_SECRET: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Rate limiting ────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 120

    # ── File storage ─────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MODEL_DIR: str = "models"
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── Sensor / processing defaults ─────────────────────────────
    # Magnetometer expected range (µT) for QMC5883L
    MAG_RANGE_MIN: float = -800.0
    MAG_RANGE_MAX: float = 800.0
    TURBIDITY_RANGE_MIN: float = 0.0
    TURBIDITY_RANGE_MAX: float = 4000.0
    PRESSURE_RANGE_MIN: float = 300.0
    PRESSURE_RANGE_MAX: float = 1200.0
    BATTERY_VOLTAGE_MIN: float = 6.0
    BATTERY_VOLTAGE_MAX: float = 16.8

    # ── Calibration ──────────────────────────────────────────────
    CALIBRATION_MIN_SAMPLES: int = 100
    CALIBRATION_INIT_WINDOW: int = 200
    BASELINE_UPDATE_RATE: float = 0.005  # EMA alpha for slow baseline update
    BASELINE_FREEZE_ANOMALY_THRESHOLD: float = 3.0  # MADs above baseline → freeze
    MAX_BASELINE_DRIFT_PER_HOUR: float = 5.0  # µT

    # ── Anomaly detection ────────────────────────────────────────
    ANOMALY_THRESHOLD: float = 0.65
    ANOMALY_CONFIRMATION_THRESHOLD: float = 0.75
    ANOMALY_WATCH_THRESHOLD: float = 0.45
    ANOMALY_MIN_PERSISTENCE_SAMPLES: int = 3
    ANOMALY_COOLDOWN_SAMPLES: int = 10

    # ── Confidence ───────────────────────────────────────────────
    CONFIDENCE_SENSOR_WEIGHT: float = 0.15
    CONFIDENCE_SIGNAL_WEIGHT: float = 0.25
    CONFIDENCE_MODEL_WEIGHT: float = 0.25
    CONFIDENCE_PERSISTENCE_WEIGHT: float = 0.15
    CONFIDENCE_CALIBRATION_WEIGHT: float = 0.10
    CONFIDENCE_ENVIRONMENT_WEIGHT: float = 0.10

    # ── ML ────────────────────────────────────────────────────────
    ML_DEFAULT_MODEL_TYPE: str = "isolation_forest"
    ML_ISOLATION_FOREST_N_ESTIMATORS: int = 200
    ML_ISOLATION_FOREST_CONTAMINATION: float = 0.05
    ML_MIN_TRAINING_SAMPLES: int = 500
    ML_RETRAIN_IMPROVEMENT_THRESHOLD: float = 0.02

    # ── Processing ───────────────────────────────────────────────
    ROLLING_WINDOW_SIZE: int = 50
    MEDIAN_FILTER_KERNEL: int = 5
    EMA_ALPHA: float = 0.1
    LOWPASS_CUTOFF_HZ: float = 2.0
    LOWPASS_SAMPLE_RATE_HZ: float = 10.0

    # ── Target clustering ────────────────────────────────────────
    CLUSTER_EPS_METERS: float = 50.0
    CLUSTER_MIN_SAMPLES: int = 3

    # ── WebSocket ────────────────────────────────────────────────
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 100

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def model_path(self) -> Path:
        p = Path(self.MODEL_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p


# Singleton — imported everywhere as `from app.core.config import settings`
settings = Settings()
