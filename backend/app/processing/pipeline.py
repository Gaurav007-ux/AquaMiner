"""
AquaYantra — Main processing pipeline orchestrator.

RAW DATA → Validation → Normalization → Outlier Detection → Filtering →
Calibration → Feature Engineering → ML Anomaly Detection → Temporal Detection →
Confidence Estimation → Detection Event → Database + WebSocket

Every stage is independently testable.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.calibration.engine import CalibrationEngine, CalibrationState
from app.core.config import settings
from app.core.logging import get_logger
from app.ml.base import AnomalyResult
from app.ml.confidence import ConfidenceEngine
from app.ml.explainability import ExplainabilityEngine
from app.ml.registry import model_registry
from app.ml.temporal import TemporalDetector, TemporalEvent
from app.processing.features import FeatureEngineer, FeatureVector
from app.processing.filters import ExponentialMovingAverage, LowPassFilter, MedianFilter
from app.processing.health import SensorHealthMonitor, SensorHealthState
from app.processing.magnetic import MagneticProcessor, MagneticReading
from app.processing.quality import DataQualityEngine, QualityResult
from app.schemas.sensor_packet import SensorPacket

logger = get_logger("processing.pipeline")


@dataclass
class ProcessingResult:
    """Complete result of processing a single sensor packet."""
    # Input
    packet: SensorPacket

    # Processing stages
    quality: QualityResult = field(default_factory=lambda: QualityResult(score=1.0))
    health: SensorHealthState = field(default_factory=SensorHealthState)
    magnetic: MagneticReading | None = None
    calibration: CalibrationState = field(default_factory=CalibrationState)
    features: FeatureVector | None = None
    anomaly: AnomalyResult = field(default_factory=AnomalyResult)
    confidence: float = 0.0
    temporal_event: TemporalEvent | None = None
    explanation: dict[str, Any] = field(default_factory=dict)

    # Derived values for storage
    magnetic_magnitude: float | None = None
    magnetic_baseline: float | None = None
    magnetic_deviation: float | None = None
    anomaly_score: float = 0.0
    detection_confidence: float = 0.0
    detection_status: str = "BACKGROUND"


class ProcessingPipeline:
    """
    Stateful per-device processing pipeline.

    One pipeline instance per active device, maintaining all
    stateful processors (filters, calibration, temporal detector).
    """

    def __init__(self, device_id: str) -> None:
        self.device_id = device_id

        # Processing components
        self._quality_engine = DataQualityEngine()
        self._health_monitor = SensorHealthMonitor()
        self._magnetic_processor = MagneticProcessor()
        self._median_filter = MedianFilter()
        self._ema_filter = ExponentialMovingAverage()
        self._lowpass_filter = LowPassFilter()
        self._calibration_engine = CalibrationEngine(device_id)
        self._feature_engineer = FeatureEngineer()
        self._confidence_engine = ConfidenceEngine()
        self._explainability = ExplainabilityEngine()
        self._temporal_detector = TemporalDetector()

        self._sample_count: int = 0

    @property
    def calibration_engine(self) -> CalibrationEngine:
        return self._calibration_engine

    def process(self, packet: SensorPacket) -> ProcessingResult:
        """
        Run a sensor packet through the complete processing pipeline.

        This is the main entry point — called for every incoming sample.
        """
        self._sample_count += 1
        result = ProcessingResult(packet=packet)

        # Stage 1: Data quality
        result.quality = self._quality_engine.evaluate(
            packet, calibration_status=self._calibration_engine.status.value
        )

        # Stage 2: Sensor health
        result.health = self._health_monitor.evaluate(packet)

        # Stage 3: Magnetometer processing
        if packet.mag_x is not None and packet.mag_y is not None and packet.mag_z is not None:
            self._process_magnetometer(packet, result)
        else:
            result.detection_status = "NO_MAG_DATA"

        return result

    def _process_magnetometer(self, packet: SensorPacket, result: ProcessingResult) -> None:
        """Process magnetometer data through calibration, features, ML, temporal detection."""
        raw_x = packet.mag_x
        raw_y = packet.mag_y
        raw_z = packet.mag_z
        ts = packet.timestamp.timestamp()

        # Stage 4: Calibration
        sensor_healthy = result.health.overall.value not in ("FAULT", "OFFLINE")
        cal_x, cal_y, cal_z, cal_state = self._calibration_engine.process_sample(
            raw_x, raw_y, raw_z,
            timestamp=ts,
            anomaly_probability=result.anomaly_score,
            sensor_healthy=sensor_healthy,
            data_quality=result.quality.score,
        )
        result.calibration = cal_state

        # Stage 5: Filtering (apply to magnitude for smooth baseline tracking)
        magnitude = math.sqrt(cal_x ** 2 + cal_y ** 2 + cal_z ** 2)
        filtered_mag = self._median_filter.apply(magnitude)
        filtered_mag = self._ema_filter.apply(filtered_mag)

        # Stage 6: Magnetic processing
        result.magnetic = self._magnetic_processor.process(
            raw_x, raw_y, raw_z,
            calibrated_x=cal_x,
            calibrated_y=cal_y,
            calibrated_z=cal_z,
            baseline=cal_state.baseline,
        )
        result.magnetic_magnitude = result.magnetic.magnitude
        result.magnetic_baseline = cal_state.baseline
        result.magnetic_deviation = result.magnetic.deviation

        # Stage 7: Feature engineering
        result.features = self._feature_engineer.build(
            mag=result.magnetic,
            depth=packet.depth,
            turbidity=packet.turbidity,
            battery_voltage=packet.battery_voltage,
            data_quality=result.quality.score,
        )

        # Stage 8: ML anomaly detection
        model = model_registry.get_any_active_model()
        if model is not None and result.features is not None:
            feature_array = np.array(result.features.to_array()).reshape(1, -1)
            result.anomaly = model.predict(feature_array[0])
        else:
            # Fallback: use statistical anomaly score from magnetic processor
            result.anomaly = AnomalyResult(
                anomaly_score=result.magnetic.normalized_anomaly_score,
                is_anomaly=result.magnetic.normalized_anomaly_score >= settings.ANOMALY_THRESHOLD,
                model_type="statistical_fallback",
            )

        result.anomaly_score = result.anomaly.anomaly_score

        # Update calibration with anomaly info (for baseline freeze)
        # Re-process calibration isn't needed — we'll use this for NEXT sample
        # The anomaly_probability feeds back on subsequent calls

        # Stage 9: Confidence
        signal_strength = self._confidence_engine.compute_signal_strength(
            result.magnetic.deviation, cal_state.noise
        )
        persistence = self._confidence_engine.compute_persistence_score(
            self._temporal_detector.consecutive_anomaly_count
        )
        result.confidence = self._confidence_engine.compute(
            sensor_quality=result.quality.score,
            signal_strength=signal_strength,
            model_score=result.anomaly.anomaly_score,
            persistence=persistence,
            calibration_quality=cal_state.quality,
            environmental_consistency=1.0,
        )
        result.detection_confidence = result.confidence

        # Stage 10: Temporal detection
        result.temporal_event = self._temporal_detector.process(
            anomaly_score=result.anomaly.anomaly_score,
            confidence=result.confidence,
            timestamp=ts,
            latitude=packet.latitude,
            longitude=packet.longitude,
            depth=packet.depth,
            feature_vector=result.features.values if result.features else None,
        )

        # Stage 11: Explainability
        result.explanation = self._explainability.explain(
            result.anomaly,
            confidence=result.confidence,
            calibration_quality=cal_state.quality,
            persistence_samples=self._temporal_detector.consecutive_anomaly_count,
            data_quality=result.quality.score,
        )
        result.detection_status = result.explanation.get("prediction", "BACKGROUND")

    def reset(self) -> None:
        """Reset all pipeline state."""
        self._magnetic_processor.reset()
        self._median_filter.reset()
        self._ema_filter.reset()
        self._lowpass_filter.reset()
        self._calibration_engine.reset()
        self._temporal_detector.reset()
        self._sample_count = 0


class PipelineManager:
    """Manages per-device processing pipelines."""

    def __init__(self) -> None:
        self._pipelines: dict[str, ProcessingPipeline] = {}

    def get_pipeline(self, device_id: str) -> ProcessingPipeline:
        """Get or create a pipeline for a device."""
        if device_id not in self._pipelines:
            self._pipelines[device_id] = ProcessingPipeline(device_id)
            logger.info("pipeline_created", device_id=device_id)
        return self._pipelines[device_id]

    def remove_pipeline(self, device_id: str) -> None:
        """Remove a device's pipeline."""
        self._pipelines.pop(device_id, None)

    def list_active(self) -> list[str]:
        return list(self._pipelines.keys())


# Global pipeline manager
pipeline_manager = PipelineManager()
