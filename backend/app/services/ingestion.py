"""
AquaYantra — Ingestion service.

Accepts SensorPackets from any transport, validates, deduplicates,
runs the processing pipeline, persists results, and broadcasts via WebSocket.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicatePacketError, InvalidSensorPacketError
from app.core.logging import get_logger
from app.models.detection import DetectionEvent
from app.models.reading import SensorReading
from app.models.survey import SurveyPoint
from app.processing.pipeline import ProcessingResult, pipeline_manager
from app.repositories.repositories import DeviceRepository, ReadingRepository
from app.schemas.sensor_packet import SensorPacket

logger = get_logger("services.ingestion")


class IngestionService:
    """
    Core sensor data ingestion service.

    Accepts a normalized SensorPacket, validates it, runs the
    processing pipeline, persists results, and returns the
    processing result for WebSocket broadcast.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._reading_repo = ReadingRepository(session)
        self._device_repo = DeviceRepository(session)
        self._seen_sequences: dict[str, set[int]] = {}

    async def ingest(self, packet: SensorPacket) -> ProcessingResult:
        """
        Process a single sensor packet end-to-end.

        Steps:
        1. Validate device exists
        2. Check for duplicate packets
        3. Run processing pipeline
        4. Persist reading
        5. Create detection event if confirmed
        6. Return result for broadcast
        """
        # Duplicate detection
        if packet.sequence is not None:
            device_seqs = self._seen_sequences.setdefault(packet.device_id, set())
            if packet.sequence in device_seqs:
                raise DuplicatePacketError(packet.device_id, packet.sequence)
            device_seqs.add(packet.sequence)
            # Keep set manageable
            if len(device_seqs) > 10000:
                min_seq = max(device_seqs) - 5000
                device_seqs -= {s for s in device_seqs if s < min_seq}

        # Run processing pipeline
        pipeline = pipeline_manager.get_pipeline(packet.device_id)
        result = pipeline.process(packet)

        # Resolve device UUID
        device = await self._device_repo.get_by_serial(packet.device_id)
        device_uuid = device.id if device else uuid.uuid4()

        # Resolve deployment UUID
        deployment_uuid = None
        if packet.deployment_id:
            try:
                deployment_uuid = uuid.UUID(packet.deployment_id)
            except ValueError:
                pass

        # Persist reading
        reading = SensorReading(
            device_id=device_uuid,
            deployment_id=deployment_uuid,
            timestamp=packet.timestamp,
            sequence=packet.sequence,
            latitude=packet.latitude,
            longitude=packet.longitude,
            depth=packet.depth,
            magnetometer_x=packet.mag_x,
            magnetometer_y=packet.mag_y,
            magnetometer_z=packet.mag_z,
            magnetic_magnitude=result.magnetic_magnitude,
            magnetic_baseline=result.magnetic_baseline,
            magnetic_deviation=result.magnetic_deviation,
            anomaly_score=result.anomaly_score,
            detection_confidence=result.detection_confidence,
            turbidity=packet.turbidity,
            pressure=packet.pressure,
            battery_voltage=packet.battery_voltage,
            battery_percent=packet.battery_percent,
            sensor_health=result.health.overall.value,
            data_quality=result.quality.score,
            raw_payload=packet.model_dump(mode="json"),
        )
        self._session.add(reading)

        # Create detection event if temporal detector confirmed
        if result.temporal_event and result.temporal_event.confirmed:
            event = self._create_detection_event(result, deployment_uuid)
            self._session.add(event)
            logger.info(
                "detection_event_created",
                device=packet.device_id,
                score=result.anomaly_score,
                confidence=result.confidence,
            )

        # Create survey point if position is available
        if packet.latitude is not None and packet.longitude is not None and deployment_uuid:
            survey = SurveyPoint(
                deployment_id=deployment_uuid,
                timestamp=packet.timestamp,
                latitude=packet.latitude,
                longitude=packet.longitude,
                depth=packet.depth,
                anomaly_score=result.anomaly_score,
                confidence=result.detection_confidence,
                target_status=result.detection_status,
                geometry=f"SRID=4326;POINT({packet.longitude} {packet.latitude})",
            )
            self._session.add(survey)

        await self._session.flush()
        return result

    async def ingest_batch(self, packets: list[SensorPacket]) -> list[ProcessingResult]:
        """Process a batch of sensor packets."""
        results = []
        for packet in packets:
            try:
                result = await self.ingest(packet)
                results.append(result)
            except (DuplicatePacketError, InvalidSensorPacketError) as e:
                logger.warning("batch_packet_rejected", error=str(e), device=packet.device_id)
        return results

    def _create_detection_event(
        self,
        result: ProcessingResult,
        deployment_id: uuid.UUID | None,
    ) -> DetectionEvent:
        """Create a DetectionEvent ORM object from a confirmed temporal event."""
        te = result.temporal_event
        lat = te.location[0] if te.location else result.packet.latitude
        lon = te.location[1] if te.location else result.packet.longitude

        location_wkt = None
        if lat is not None and lon is not None:
            location_wkt = f"SRID=4326;POINT({lon} {lat})"

        return DetectionEvent(
            deployment_id=deployment_id or uuid.uuid4(),
            timestamp=datetime.fromtimestamp(te.start_time, tz=timezone.utc),
            end_timestamp=datetime.fromtimestamp(te.end_time, tz=timezone.utc) if te.end_time else None,
            location=location_wkt,
            latitude=lat,
            longitude=lon,
            depth=te.depth,
            anomaly_score=te.peak_anomaly,
            confidence=te.confidence,
            peak_strength=te.peak_anomaly,
            mean_strength=te.mean_anomaly,
            duration_seconds=te.duration_seconds,
            sample_count=te.sample_count,
            feature_vector=te.feature_vector,
            classification=result.detection_status,
            explanation=result.explanation,
            status="detected",
        )
