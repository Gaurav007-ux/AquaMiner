"""AquaYantra — Detection, Survey, Calibration, ML, Analytics, Quality, Health, WebSocket schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import OrmBase


# ── Detection ────────────────────────────────────────────────────

class DetectionEventResponse(OrmBase):
    id: uuid.UUID
    deployment_id: uuid.UUID
    timestamp: datetime
    end_timestamp: datetime | None
    latitude: float | None
    longitude: float | None
    depth: float | None
    anomaly_score: float
    confidence: float
    peak_strength: float | None
    mean_strength: float | None
    duration_seconds: float | None
    sample_count: int | None
    classification: str | None
    explanation: dict[str, Any] | None
    status: str


# ── Survey ───────────────────────────────────────────────────────

class SurveyPointResponse(OrmBase):
    id: uuid.UUID
    deployment_id: uuid.UUID
    timestamp: datetime
    latitude: float
    longitude: float
    depth: float | None
    anomaly_score: float | None
    confidence: float | None
    target_status: str | None
    environmental_context: dict[str, Any] | None


# ── Calibration ──────────────────────────────────────────────────

class CalibrationProfileResponse(OrmBase):
    id: uuid.UUID
    device_id: uuid.UUID
    sensor_id: uuid.UUID | None
    version: int
    hard_iron_offset_x: float
    hard_iron_offset_y: float
    hard_iron_offset_z: float
    soft_iron_matrix: dict | None
    axis_scale_x: float
    axis_scale_y: float
    axis_scale_z: float
    baseline: float | None
    noise_level: float | None
    calibration_quality: float | None
    calibration_status: str
    sample_count: int
    active: bool
    created_at: datetime
    updated_at: datetime


class CalibrationStartRequest(BaseModel):
    """Request to initiate a calibration session."""
    sensor_id: uuid.UUID | None = None
    force: bool = False


class CalibrationStatusResponse(BaseModel):
    device_id: str
    status: str
    calibration_quality: float | None
    baseline: float | None
    noise_level: float | None
    sample_count: int
    hard_iron_offset: list[float]
    message: str


# ── ML ───────────────────────────────────────────────────────────

class MLModelResponse(OrmBase):
    id: uuid.UUID
    name: str
    version: int
    model_type: str
    description: str | None
    feature_version: str | None
    training_samples: int | None
    training_timestamp: datetime | None
    metrics: dict[str, Any] | None
    status: str
    created_at: datetime


class TrainRequest(BaseModel):
    model_type: str = "isolation_forest"
    name: str | None = None
    description: str | None = None
    deployment_id: uuid.UUID | None = None
    parameters: dict[str, Any] | None = None


class PredictionResponse(OrmBase):
    id: uuid.UUID
    deployment_id: uuid.UUID | None
    model_id: uuid.UUID
    timestamp: datetime
    anomaly_score: float
    confidence: float
    prediction: str
    explanation: dict[str, Any] | None
    feature_values: dict[str, Any] | None


# ── Analytics ────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_devices: int = 0
    active_devices: int = 0
    total_missions: int = 0
    active_missions: int = 0
    total_deployments: int = 0
    total_readings: int = 0
    total_detections: int = 0
    total_targets: int = 0
    average_anomaly_score: float | None = None
    last_reading_at: datetime | None = None


class MagneticAnalytics(BaseModel):
    deployment_id: uuid.UUID | None = None
    mean_magnitude: float | None = None
    std_magnitude: float | None = None
    min_magnitude: float | None = None
    max_magnitude: float | None = None
    baseline: float | None = None
    noise_level: float | None = None
    anomaly_count: int = 0
    reading_count: int = 0


# ── Data Quality ─────────────────────────────────────────────────

class DataQualityReport(BaseModel):
    quality_score: float = Field(ge=0.0, le=1.0)
    issues: list[str] = []
    status: str  # GOOD, ACCEPTABLE, DEGRADED, POOR
    details: dict[str, Any] = {}


# ── Sensor Health ────────────────────────────────────────────────

class SensorHealthReport(BaseModel):
    device_id: str
    overall_status: str  # HEALTHY, WARNING, DEGRADED, FAULT, OFFLINE
    magnetometer: str = "unknown"
    turbidity_sensor: str = "unknown"
    pressure_sensor: str = "unknown"
    gps: str = "unknown"
    battery: str = "unknown"
    issues: list[str] = []
    last_reading_at: datetime | None = None


# ── System Health ────────────────────────────────────────────────

class SystemHealthResponse(BaseModel):
    status: str  # healthy, degraded, unhealthy
    database: str
    redis: str
    ml_service: str
    websocket_connections: int
    active_devices: int
    processing_latency_ms: float | None = None
    last_sensor_timestamp: datetime | None = None
    uptime_seconds: float
    version: str


# ── WebSocket messages ───────────────────────────────────────────

class WSMessage(BaseModel):
    """Schema for WebSocket broadcast messages."""
    type: str  # reading, detection, calibration, health, heartbeat
    device_id: str | None = None
    deployment_id: str | None = None
    timestamp: datetime
    data: dict[str, Any]


# ── Target ───────────────────────────────────────────────────────

class TargetCandidate(BaseModel):
    target_id: str
    latitude: float
    longitude: float
    observation_count: int
    peak_anomaly_score: float
    mean_anomaly_score: float
    confidence: float
    spatial_extent_meters: float | None = None
    depth_range: list[float] | None = None
    priority: str  # LOW, MEDIUM, HIGH, VERY_HIGH
    status: str  # candidate, confirmed, dismissed


# ── Map endpoints ────────────────────────────────────────────────

class MapPointResponse(BaseModel):
    latitude: float
    longitude: float
    anomaly_score: float | None = None
    confidence: float | None = None
    timestamp: datetime | None = None
    depth: float | None = None
    point_type: str = "survey"  # survey, anomaly, target


# ── Mineral Prospectivity Heatmap ────────────────────────────────

class MineralHeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    intensity: float = Field(ge=0.0, le=1.0, description="Normalized heat intensity 0.0-1.0")
    mineral_type: str = Field(description="POLYMETALLIC_NODULES, MASSIVE_SULFIDES, COBALT_CRUSTS, FERROMAGNETIC_ANOMALY, BACKGROUND")
    confidence: float = Field(ge=0.0, le=1.0)
    anomaly_score: float = Field(ge=0.0, le=1.0)
    depth: float | None = None
    magnetic_deviation: float | None = None
    turbidity: float | None = None
    temperature_delta: float | None = None
    ph: float | None = None
    timestamp: datetime | None = None


class MineralHeatmapResponse(BaseModel):
    total_points: int
    mineral_summary: dict[str, int]
    points: list[MineralHeatmapPoint]

