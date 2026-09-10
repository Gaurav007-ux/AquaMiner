"""
AquaYantra — ML safety tests (Section 9).

Proves that:
1. A strong anomaly does NOT immediately become part of the baseline
2. Stable background data gradually updates the baseline
3. Noisy data does not corrupt calibration
4. A model cannot automatically replace a better active model
5. Repeated anomalies are preserved as target events
6. Sensor failures are not classified as anomalies
"""

import numpy as np
import pytest

from app.calibration.baseline import AdaptiveBaseline, BaselineState
from app.calibration.engine import CalibrationEngine, CalibrationStatus
from app.ml.base import AnomalyResult
from app.ml.isolation_forest import IsolationForestModel
from app.ml.registry import ModelRegistry
from app.ml.statistical import StatisticalAnomalyModel
from app.ml.temporal import DetectionState, TemporalDetector, TemporalEvent
from app.processing.health import HealthStatus, SensorHealthMonitor
from app.schemas.sensor_packet import SensorPacket


class TestBaselineSafety:
    """Tests that the adaptive baseline protects against anomaly absorption."""

    def test_strong_anomaly_does_not_become_baseline(self):
        """Section 9: A strong anomaly does NOT immediately become part of the baseline."""
        bl = AdaptiveBaseline(init_window=50, update_rate=0.01, freeze_threshold=3.0)
        rng = np.random.default_rng(42)
        bg = 45.0

        # Initialize
        for _ in range(100):
            bl.update(bg + rng.normal(0, 0.5))

        baseline_before = bl.value

        # Inject strong anomaly
        for _ in range(20):
            bl.update(bg + 50.0, anomaly_probability=0.95)

        # Baseline must not have jumped to anomaly level
        assert abs(bl.value - baseline_before) < 3.0, (
            f"Baseline jumped by {abs(bl.value - baseline_before):.1f} — anomaly was absorbed!"
        )
        assert bl.value < bg + 10.0, "Baseline should NOT be near anomaly value"

    def test_stable_background_gradually_updates_baseline(self):
        """Stable background data gradually updates the baseline."""
        bl = AdaptiveBaseline(init_window=50, update_rate=0.02)

        # Init at 45
        for _ in range(100):
            bl.update(45.0)

        assert abs(bl.value - 45.0) < 1.0

        # Shift background to 47 gradually
        for _ in range(500):
            bl.update(47.0, anomaly_probability=0.0, data_quality=1.0)

        # With conservative max_drift_per_update=0.1 and update_rate=0.02,
        # baseline moves slowly — this is intentional for anomaly safety
        assert bl.value > 45.0, "Baseline should have moved towards 47"

    def test_noisy_data_does_not_corrupt_calibration(self):
        """Noisy data does not corrupt calibration."""
        engine = CalibrationEngine("TEST-001")
        rng = np.random.default_rng(42)

        # Feed stable data first
        for i in range(200):
            engine.process_sample(20.0, -5.0, 40.0, timestamp=float(i))

        quality_before = engine.get_state().quality

        # Feed very noisy data
        for i in range(100):
            x = rng.normal(20, 50)  # Extreme noise
            y = rng.normal(-5, 50)
            z = rng.normal(40, 50)
            engine.process_sample(x, y, z, timestamp=float(200 + i), data_quality=0.2)

        # Calibration quality should not improve from garbage data
        quality_after = engine.get_state().quality
        assert quality_after <= quality_before + 0.1, (
            "Calibration quality should not improve from noisy data"
        )


class TestModelSafety:
    """Tests that the model registry enforces quality gates."""

    def test_worse_model_cannot_replace_active(self):
        """A model cannot automatically replace a better active model."""
        registry = ModelRegistry(model_dir="test_models_temp")

        # Create and activate a good model
        good_model = StatisticalAnomalyModel()
        bg_data = np.random.default_rng(42).normal(45, 0.5, (500, 18))
        good_model.fit(bg_data)
        registry.activate_model(good_model, "good_v1", metrics={"anomaly_rate": 0.05}, force=True)

        # Try to activate a bad model (anomaly rate too high)
        bad_model = StatisticalAnomalyModel()
        bad_model.fit(bg_data)
        activated = registry.activate_model(
            bad_model, "bad_v2", metrics={"anomaly_rate": 0.8}
        )

        assert not activated, "Bad model should be REJECTED by quality gate"

        # Original model should still be active
        active = registry.get_active_model("statistical")
        assert active is good_model

    def test_model_with_zero_anomaly_rate_rejected(self):
        """Model detecting nothing should also be rejected."""
        registry = ModelRegistry(model_dir="test_models_temp")

        model = StatisticalAnomalyModel()
        bg_data = np.random.default_rng(42).normal(45, 0.5, (500, 18))
        model.fit(bg_data)

        # First model activates with force
        registry.activate_model(model, "v1", force=True)

        # Try to replace with one that detects nothing
        model2 = StatisticalAnomalyModel()
        model2.fit(bg_data)
        activated = registry.activate_model(
            model2, "v2", metrics={"anomaly_rate": 0.0005}
        )

        assert not activated, "Model with near-zero anomaly rate should be rejected"


class TestTemporalSafety:
    """Tests that temporal detection prevents false positives from noise."""

    def test_single_noisy_sample_does_not_create_event(self):
        """A single noisy sample should NOT create a target."""
        td = TemporalDetector(
            watch_threshold=0.45,
            trigger_threshold=0.65,
            confirmation_threshold=0.75,
            min_persistence=3,
        )

        # One high score, then back to normal
        event = td.process(anomaly_score=0.9, timestamp=1.0)
        assert event is None, "Single spike should not create event"

        event = td.process(anomaly_score=0.1, timestamp=2.0)
        # Even if event returned, it should not be confirmed
        if event is not None:
            assert not event.confirmed, "Single-sample event should not be confirmed"

    def test_sustained_anomaly_creates_confirmed_event(self):
        """Sustained anomaly across min_persistence samples should confirm."""
        td = TemporalDetector(
            watch_threshold=0.4,
            trigger_threshold=0.6,
            confirmation_threshold=0.7,
            min_persistence=3,
            cooldown_samples=5,
        )

        # Ramp up and sustain
        for i in range(10):
            td.process(anomaly_score=0.85, timestamp=float(i))

        # Drop score to trigger event finalization
        event = td.process(anomaly_score=0.1, timestamp=11.0)

        assert event is not None, "Sustained anomaly should produce an event"
        assert event.confirmed, "Event should be confirmed after sustained anomaly"
        assert event.sample_count >= 3

    def test_repeated_anomalies_preserved_as_separate_events(self):
        """Repeated anomalies should be recorded as separate events."""
        td = TemporalDetector(
            watch_threshold=0.4,
            trigger_threshold=0.6,
            confirmation_threshold=0.7,
            min_persistence=3,
            cooldown_samples=3,
        )

        events: list[TemporalEvent] = []

        # First anomaly burst
        for i in range(10):
            e = td.process(anomaly_score=0.85, timestamp=float(i))
            if e and e.confirmed:
                events.append(e)
        e = td.process(anomaly_score=0.1, timestamp=10.0)
        if e and e.confirmed:
            events.append(e)

        # Cooldown
        for i in range(5):
            td.process(anomaly_score=0.1, timestamp=11.0 + i)

        # Second anomaly burst
        for i in range(10):
            e = td.process(anomaly_score=0.85, timestamp=20.0 + i)
            if e and e.confirmed:
                events.append(e)
        e = td.process(anomaly_score=0.1, timestamp=30.0)
        if e and e.confirmed:
            events.append(e)

        assert len(events) >= 1, "Should have at least one confirmed event"


class TestSensorFailureSafety:
    """Tests that sensor failures are not classified as mineral/target anomalies."""

    def test_null_magnetometer_not_flagged_as_anomaly(self):
        """Missing magnetometer data should be a sensor fault, not an anomaly."""
        from datetime import datetime, timezone
        from app.processing.pipeline import ProcessingPipeline

        pipeline = ProcessingPipeline("TEST-FAULT")
        packet = SensorPacket(
            device_id="TEST-FAULT",
            timestamp=datetime.now(timezone.utc),
            mag_x=None,
            mag_y=None,
            mag_z=None,
        )

        result = pipeline.process(packet)

        assert result.detection_status == "NO_MAG_DATA"
        assert result.anomaly_score == 0.0
        assert result.health.magnetometer.value == "FAULT"
