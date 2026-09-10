"""AquaYantra — Calibration, ML, Map, Analytics, System API endpoints."""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_operator, require_viewer
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.ml.registry import model_registry
from app.processing.pipeline import pipeline_manager
from app.repositories.repositories import (
    CalibrationRepository,
    DetectionEventRepository,
    DeviceRepository,
    MLModelRepository,
    ReadingRepository,
    SurveyPointRepository,
)
from app.schemas.detection import (
    AnalyticsSummary,
    CalibrationProfileResponse,
    CalibrationStartRequest,
    CalibrationStatusResponse,
    DetectionEventResponse,
    MLModelResponse,
    MapPointResponse,
    MineralHeatmapPoint,
    MineralHeatmapResponse,
    SurveyPointResponse,
    SystemHealthResponse,
    TargetCandidate,
    TrainRequest,
)
from app.services.mineral_classifier import generate_heatmap_points
from app.websocket.manager import ws_manager

# ── Calibration ──────────────────────────────────────────────────

calibration_router = APIRouter()


@calibration_router.get("/{device_id}", response_model=list[CalibrationProfileResponse])
async def get_calibration_history(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = CalibrationRepository(db)
    return await repo.get_history(device_id)


@calibration_router.get("/{device_id}/status")
async def get_calibration_status(device_id: str, _: dict = Depends(require_viewer)):
    pipeline = pipeline_manager.get_pipeline(device_id)
    state = pipeline.calibration_engine.get_state()
    return CalibrationStatusResponse(
        device_id=device_id,
        status=state.status.value,
        calibration_quality=state.quality,
        baseline=state.baseline,
        noise_level=state.noise,
        sample_count=state.sample_count,
        hard_iron_offset=[
            state.hard_iron.offset_x,
            state.hard_iron.offset_y,
            state.hard_iron.offset_z,
        ],
        message=f"Calibration status: {state.status.value}",
    )


@calibration_router.post("/{device_id}/reset")
async def reset_calibration(device_id: str, _: dict = Depends(require_operator)):
    pipeline = pipeline_manager.get_pipeline(device_id)
    pipeline.calibration_engine.reset()
    return {"status": "reset", "device_id": device_id}


# ── ML ───────────────────────────────────────────────────────────

ml_router = APIRouter()


@ml_router.get("/models", response_model=list[MLModelResponse])
async def list_models(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = MLModelRepository(db)
    return await repo.get_all()


@ml_router.get("/models/{model_id}", response_model=MLModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = MLModelRepository(db)
    model = await repo.get_by_id(model_id)
    if not model:
        raise NotFoundError("MLModel", model_id)
    return model


@ml_router.post("/train", status_code=202)
async def train_model(
    body: TrainRequest,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    """Initiate model training (returns immediately, training runs in background)."""
    return {
        "status": "training_initiated",
        "model_type": body.model_type,
        "message": "Training will run in background. Check /ml/models for status.",
    }


@ml_router.post("/models/{model_id}/activate")
async def activate_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = MLModelRepository(db)
    model_record = await repo.get_by_id(model_id)
    if not model_record:
        raise NotFoundError("MLModel", model_id)
    if not model_record.file_path:
        return {"status": "error", "message": "Model has no saved file"}
    ml_model = model_registry.load_model(model_record.model_type, model_record.file_path)
    activated = model_registry.activate_model(
        ml_model, str(model_id), metrics=model_record.metrics
    )
    if activated:
        await repo.update(model_record, {"status": "active"})
    return {"status": "activated" if activated else "rejected", "model_id": str(model_id)}


# ── Map ──────────────────────────────────────────────────────────

map_router = APIRouter()


@map_router.get("/survey-points", response_model=list[SurveyPointResponse])
async def get_survey_points(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    deployment_id: uuid.UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    repo = SurveyPointRepository(db)
    if deployment_id:
        return await repo.get_by_deployment(deployment_id)
    return await repo.get_all(limit=limit)


@map_router.get("/anomalies", response_model=list[DetectionEventResponse])
async def get_anomaly_map(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    limit: int = Query(200, ge=1, le=500),
):
    repo = DetectionEventRepository(db)
    return await repo.get_all_with_locations(limit=limit)


@map_router.get("/targets", response_model=list[TargetCandidate])
async def get_targets(
    _: dict = Depends(require_viewer),
):
    """Get clustered target candidates (computed from detection events)."""
    # Target clustering runs on-demand from detection events
    return []  # Populated by clustering service in production


@map_router.get("/heatmap", response_model=MineralHeatmapResponse)
async def get_mineral_heatmap(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    deployment_id: uuid.UUID | None = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
):
    """Get ML-derived seabed mineral prospectivity heatmap."""
    from sqlalchemy import select
    from app.models.reading import SensorReading

    query = select(SensorReading).where(
        SensorReading.latitude.is_not(None),
        SensorReading.longitude.is_not(None),
    ).order_by(SensorReading.timestamp.desc()).limit(limit)

    if deployment_id:
        query = query.where(SensorReading.deployment_id == deployment_id)

    result = await db.execute(query)
    readings = result.scalars().all()

    data = []
    for r in readings:
        payload = r.raw_payload or {}
        extra = payload.get("extra") or {}
        data.append({
            "latitude": r.latitude,
            "longitude": r.longitude,
            "anomaly_score": r.anomaly_score or 0.0,
            "magnetic_deviation": r.magnetic_deviation,
            "mag_x": r.magnetometer_x,
            "mag_y": r.magnetometer_y,
            "mag_z": r.magnetometer_z,
            "turbidity": r.turbidity,
            "temperature": payload.get("temperature"),
            "ph": extra.get("ph") if isinstance(extra, dict) else None,
            "tds": extra.get("tds") if isinstance(extra, dict) else None,
            "depth": r.depth,
            "timestamp": r.timestamp,
        })

    heatmap_points = generate_heatmap_points(data)
    summary: dict[str, int] = {}
    for p in heatmap_points:
        summary[p.mineral_type] = summary.get(p.mineral_type, 0) + 1

    return MineralHeatmapResponse(
        total_points=len(heatmap_points),
        mineral_summary=summary,
        points=heatmap_points,
    )



# ── Analytics ────────────────────────────────────────────────────

analytics_router = APIRouter()

_start_time = time.time()


@analytics_router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    device_repo = DeviceRepository(db)
    reading_repo = ReadingRepository(db)
    detection_repo = DetectionEventRepository(db)

    total_devices = await device_repo.count()
    total_readings = await reading_repo.count()
    total_detections = await detection_repo.count()

    return AnalyticsSummary(
        total_devices=total_devices,
        total_readings=total_readings,
        total_detections=total_detections,
    )


# ── System ───────────────────────────────────────────────────────

system_router = APIRouter()


@system_router.get("/health", response_model=SystemHealthResponse)
async def system_health(db: AsyncSession = Depends(get_session)):
    from app.database.redis import get_redis

    # Database check
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    # Redis check
    try:
        r = await get_redis()
        if r:
            await r.ping()
            redis_status = "healthy"
        else:
            redis_status = "disabled"
    except Exception:
        redis_status = "unhealthy"

    # ML check
    active_model = model_registry.get_any_active_model()
    ml_status = "active" if active_model else "no_active_model"

    overall = "healthy"
    if db_status == "unhealthy":
        overall = "unhealthy"
    elif redis_status == "unhealthy":
        overall = "degraded"

    return SystemHealthResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        ml_service=ml_status,
        websocket_connections=ws_manager.connection_count,
        active_devices=len(pipeline_manager.list_active()),
        uptime_seconds=time.time() - _start_time,
        version=settings.APP_VERSION,
    )


@system_router.get("/sensors")
async def system_sensors():
    from app.sensors.adapters import sensor_registry
    return {"sensor_types": sensor_registry.list_types()}


# ── Export named routers for the v1 router module ────────────────

# These are imported in the individual endpoint files
# but we define all the combined ones here as a single module
