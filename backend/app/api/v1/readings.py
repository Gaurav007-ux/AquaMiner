import csv
import io
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_operator, require_viewer
from app.core.exceptions import NotFoundError
from app.models.reading import SensorReading
from app.repositories.repositories import ReadingRepository
from app.schemas.reading import ReadingCompactResponse, ReadingResponse
from app.schemas.sensor_packet import BatchSensorPacket, SensorPacket
from app.services.ingestion import IngestionService
from app.websocket.manager import ws_manager

router = APIRouter()


@router.post("", status_code=201)
async def ingest_reading(
    packet: SensorPacket,
    db: AsyncSession = Depends(get_session),
):
    """Ingest a single sensor reading (no auth — device endpoint)."""
    svc = IngestionService(db)
    result = svc_result = await svc.ingest(packet)

    # Broadcast to WebSocket
    ws_data = {
        "type": "reading",
        "device_id": packet.device_id,
        "timestamp": packet.timestamp.isoformat(),
        "data": {
            "magnetic_magnitude": result.magnetic_magnitude,
            "magnetic_baseline": result.magnetic_baseline,
            "magnetic_deviation": result.magnetic_deviation,
            "anomaly_score": result.anomaly_score,
            "confidence": result.detection_confidence,
            "detection_status": result.detection_status,
            "depth": packet.depth,
            "turbidity": packet.turbidity,
            "battery_voltage": packet.battery_voltage,
            "sensor_health": result.health.overall.value,
            "calibration_status": result.calibration.status.value,
            "data_quality": result.quality.score,
        },
    }
    await ws_manager.send_to_device(packet.device_id, ws_data)
    if packet.deployment_id:
        await ws_manager.send_to_deployment(packet.deployment_id, ws_data)

    return {
        "status": "ingested",
        "anomaly_score": result.anomaly_score,
        "confidence": result.detection_confidence,
        "detection_status": result.detection_status,
        "quality": result.quality.score,
    }


@router.post("/batch", status_code=201)
async def ingest_batch(
    body: BatchSensorPacket,
    db: AsyncSession = Depends(get_session),
):
    """Ingest a batch of sensor readings."""
    svc = IngestionService(db)
    results = await svc.ingest_batch(body.packets)
    return {"ingested": len(results), "total": len(body.packets)}


@router.get("", response_model=list[ReadingCompactResponse])
async def list_readings(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    device_id: uuid.UUID | None = Query(None),
    deployment_id: uuid.UUID | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    repo = ReadingRepository(db)
    if deployment_id:
        return await repo.get_by_deployment(deployment_id, offset=offset, limit=limit)
    elif device_id:
        return await repo.get_by_device(device_id, limit=limit)
    return await repo.get_all(offset=offset, limit=limit)


@router.get("/latest", response_model=ReadingCompactResponse | None)
async def get_latest_reading(
    db: AsyncSession = Depends(get_session),
    device_id: uuid.UUID | None = Query(None),
):
    """Get the single most recent sensor reading with position and anomaly data."""
    repo = ReadingRepository(db)
    if device_id:
        readings = await repo.get_by_device(device_id, limit=1)
    else:
        readings = await repo.get_all(limit=1)
    return readings[0] if readings else None


@router.post("/upload-csv", status_code=201)
async def upload_csv(
    request: Request,
    file: UploadFile | None = File(None),
    device_id: str = Query("AQUAYANTRA-001"),
    base_lat: float | None = Query(None),
    base_lon: float | None = Query(None),
    db: AsyncSession = Depends(get_session),
):
    """
    Ingest and process SD card CSV data (SRV_xxx.CSV or EVT_xxx.CSV).
    Directly feeds records into the ML model and pipeline.
    """
    content = ""
    if file:
        content = (await file.read()).decode("utf-8", errors="ignore")
    else:
        body = await request.body()
        content = body.decode("utf-8", errors="ignore")

    if not content.strip():
        return {"status": "error", "message": "Empty CSV content", "processed_rows": 0}

    # 1. Parse comments (#BASE_LAT, #BASE_LON, #FILE) and clean data rows
    clean_csv_lines: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#BASE_LAT:"):
            try:
                val = float(line.split(":", 1)[1])
                if val != 0.0 and (base_lat is None or base_lat == 0.0):
                    base_lat = val
            except Exception:
                pass
        elif line.startswith("#BASE_LON:"):
            try:
                val = float(line.split(":", 1)[1])
                if val != 0.0 and (base_lon is None or base_lon == 0.0):
                    base_lon = val
            except Exception:
                pass
        elif not line.startswith("#"):
            clean_csv_lines.append(line)

    if not clean_csv_lines:
        return {"status": "error", "message": "No data rows found in CSV", "processed_rows": 0}

    # 2. If base_lat/base_lon still missing, fetch most recent real GPS reading from DB
    if base_lat is None or base_lat == 0.0 or base_lon is None or base_lon == 0.0:
        res = await db.execute(
            select(SensorReading)
            .where(SensorReading.latitude.isnot(None))
            .where(SensorReading.longitude.isnot(None))
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        latest_gps = res.scalar_one_or_none()
        if latest_gps and latest_gps.latitude and latest_gps.longitude:
            base_lat = latest_gps.latitude
            base_lon = latest_gps.longitude

    reader = csv.DictReader(io.StringIO("\n".join(clean_csv_lines)))
    svc = IngestionService(db)
    processed = 0
    anomalies = 0
    now = datetime.now(timezone.utc)

    # Capture first timestamp_ms value to compute relative offsets
    rows_first_ts = 0
    all_rows = list(reader)
    if all_rows and "timestamp_ms" in all_rows[0]:
        try:
            rows_first_ts = int(float(all_rows[0].get("timestamp_ms", 0)))
        except Exception:
            rows_first_ts = 0

    for i, row in enumerate(all_rows):
        try:
            # ── Magnetometer: Support both detailed 3-axis AND STM32 AquaYantra mag_mean format ──
            if "mag_mean" in row:
                # STM32 AquaYantra SURV_xxx.CSV format: mag_mean, mag_min, mag_max, mag_std
                mag_mean = float(row.get("mag_mean") or 0.0)
                # Use mag_mean as X-axis magnitude (Y/Z = 0) so downstream
                # pipeline.process() computes sqrt(x²+y²+z²) == mag_mean
                mag_x = mag_mean
                mag_y = 0.0
                mag_z = 0.0
            else:
                mag_x = float(row.get("mag_x_uT") or row.get("mag_x") or 0.0)
                mag_y = float(row.get("mag_y_uT") or row.get("mag_y") or 0.0)
                mag_z = float(row.get("mag_z_uT") or row.get("mag_z") or 0.0)

            turbidity = float(row.get("turbidity_ntu") or row.get("turbidity") or 0.0)
            pressure = float(row.get("pressure_hPa") or row.get("pressure") or 1013.25)
            depth = float(row.get("depth_m") or row.get("depth") or 0.0)
            temp = float(row.get("temp_c") or row.get("temperature_c") or row.get("temperature") or 24.0)
            batt_v = float(row.get("battery_v") or row.get("battery_voltage") or 12.0)
            batt_pct = float(row.get("battery_pct") or row.get("battery_percent") or 100.0)

            # ── Timestamp: Support timestamp_ms (millis since boot) from STM32 ──
            row_timestamp = now
            ts_ms_raw = row.get("timestamp_ms")
            if ts_ms_raw:
                try:
                    offset_ms = int(float(ts_ms_raw)) - rows_first_ts
                    row_timestamp = now + timedelta(milliseconds=offset_ms)
                except Exception:
                    pass

            # Georeferencing: Use row lat/lon if present, otherwise calculate dive swath from base station GPS
            if "latitude" in row and row["latitude"] and float(row["latitude"]) != 0.0:
                lat = float(row["latitude"])
                lon = float(row.get("longitude", 0.0))
            elif base_lat is not None and base_lon is not None:
                # Underwater survey transect pattern (~15m swath lanes, ~1m step per row)
                leg = i // 25
                step_in_leg = i % 25
                forward = (step_in_leg * 1.5) if (leg % 2 == 0) else ((25 - step_in_leg) * 1.5)
                lat = round(base_lat + (forward * 0.00001), 6)
                lon = round(base_lon + (leg * 15.0 * 0.00001), 6)
            else:
                lat = None
                lon = None

            # ── Extra fields: mag_min, mag_max, mag_std from AquaYantra format ──
            extra_data: dict = {
                "ph": float(row.get("ph") or 7.0),
                "tds": float(row.get("tds_ppm") or row.get("tds") or 0.0),
                "rate_of_change": float(row.get("rate_of_change_uT_s") or 0.0),
            }
            if "mag_min" in row:
                extra_data["mag_min"] = float(row.get("mag_min") or 0.0)
            if "mag_max" in row:
                extra_data["mag_max"] = float(row.get("mag_max") or 0.0)
            if "mag_std" in row:
                extra_data["mag_std"] = float(row.get("mag_std") or 0.0)

            # Create SensorPacket
            packet = SensorPacket(
                device_id=device_id,
                timestamp=row_timestamp,
                sequence=int(row.get("sequence") or i),
                mag_x=mag_x,
                mag_y=mag_y,
                mag_z=mag_z,
                turbidity=turbidity,
                pressure=pressure,
                temperature=temp,
                depth=depth,
                latitude=lat,
                longitude=lon,
                battery_voltage=batt_v,
                battery_percent=batt_pct,
                extra=extra_data,
            )

            result = await svc.ingest(packet)
            processed += 1
            if result.anomaly_score >= 0.65:
                anomalies += 1
        except Exception:
            continue

    return {
        "status": "success",
        "processed_rows": processed,
        "anomalies_detected": anomalies,
        "message": f"Processed {processed} sensor readings through ML model ({anomalies} anomalies detected)."
    }


@router.get("/{reading_id}", response_model=ReadingResponse)
async def get_reading(
    reading_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = ReadingRepository(db)
    reading = await repo.get_by_id(reading_id)
    if not reading:
        raise NotFoundError("SensorReading", reading_id)
    return reading

