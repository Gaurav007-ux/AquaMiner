"""
AquaYantra — Calibration unit tests.

Tests hard-iron, soft-iron, baseline, drift, and the orchestration engine.
"""

import math
import numpy as np
import pytest

from app.calibration.hard_iron import HardIronCalibrator
from app.calibration.soft_iron import SoftIronCalibrator, apply_calibration
from app.calibration.baseline import AdaptiveBaseline, BaselineState
from app.calibration.drift import DriftCompensator
from app.calibration.engine import CalibrationEngine, CalibrationStatus


class TestHardIron:
    def test_median_estimate_centered_data(self):
        cal = HardIronCalibrator()
        rng = np.random.default_rng(42)
        # Data centered at (10, -5, 15)
        for _ in range(100):
            cal.add_sample(
                10 + rng.normal(0, 1),
                -5 + rng.normal(0, 1),
                15 + rng.normal(0, 1),
            )
        result = cal.estimate()
        assert abs(result.offset_x - 10) < 2.0
        assert abs(result.offset_y - (-5)) < 2.0
        assert abs(result.offset_z - 15) < 2.0
        assert result.method == "median"

    def test_insufficient_samples(self):
        cal = HardIronCalibrator()
        cal.add_sample(1, 2, 3)
        result = cal.estimate()
        assert result.method == "insufficient_data"

    def test_sphere_fit_with_enough_data(self):
        cal = HardIronCalibrator()
        rng = np.random.default_rng(42)
        offset = np.array([5.0, -3.0, 8.0])
        for _ in range(300):
            direction = rng.normal(0, 1, 3)
            direction /= np.linalg.norm(direction)
            point = offset + direction * 45.0 + rng.normal(0, 0.5, 3)
            cal.add_sample(*point)

        result = cal.estimate()
        assert result.sample_count == 300
        # Should try sphere fit
        assert result.method in ("sphere_fit", "median")


class TestSoftIron:
    def test_identity_with_insufficient_data(self):
        cal = SoftIronCalibrator()
        for _ in range(50):
            cal.add_sample(1, 2, 3)
        result = cal.estimate()
        assert result.is_identity

    def test_apply_calibration_identity(self):
        x, y, z = apply_calibration(20.0, -5.0, 40.0, offset_x=0, offset_y=0, offset_z=0)
        assert x == 20.0
        assert y == -5.0
        assert z == 40.0

    def test_apply_calibration_with_offset(self):
        x, y, z = apply_calibration(20.0, -5.0, 40.0, offset_x=5.0, offset_y=-2.0, offset_z=3.0)
        assert abs(x - 15.0) < 1e-10
        assert abs(y - (-3.0)) < 1e-10
        assert abs(z - 37.0) < 1e-10


class TestAdaptiveBaseline:
    def test_initialization_phase(self):
        bl = AdaptiveBaseline(init_window=10)
        for i in range(5):
            bl.update(45.0)
        assert bl.state == BaselineState.INITIALIZING

    def test_initialization_completes(self):
        bl = AdaptiveBaseline(init_window=10)
        for i in range(15):
            bl.update(45.0)
        assert bl.state == BaselineState.TRACKING
        assert abs(bl.value - 45.0) < 1.0

    def test_force_freeze(self):
        bl = AdaptiveBaseline(init_window=10)
        for _ in range(20):
            bl.update(45.0)
        bl.force_freeze("manual_test")
        assert bl.state == BaselineState.FROZEN

    def test_unfreeze(self):
        bl = AdaptiveBaseline(init_window=10)
        for _ in range(20):
            bl.update(45.0)
        bl.force_freeze()
        bl.unfreeze()
        assert bl.state == BaselineState.TRACKING

    def test_reset(self):
        bl = AdaptiveBaseline(init_window=10)
        for _ in range(20):
            bl.update(45.0)
        bl.reset()
        assert bl.state == BaselineState.UNINITIALIZED
        assert bl.sample_count == 0


class TestDriftCompensator:
    def test_no_drift_with_stable_baseline(self):
        dc = DriftCompensator()
        for i in range(20):
            est = dc.record(float(i * 60), 45.0, 0.5)
        assert not est.is_drifting

    def test_drift_detected(self):
        dc = DriftCompensator(max_drift_per_hour=1.0)
        # Simulate 5 µT drift over 1 hour
        for i in range(100):
            t = float(i * 36)  # ~1 hour total
            baseline = 45.0 + (i / 100.0) * 5.0
            est = dc.record(t, baseline, 0.5)
        assert est.is_drifting


class TestCalibrationEngine:
    def test_uncalibrated_on_init(self):
        engine = CalibrationEngine("TEST")
        assert engine.status == CalibrationStatus.UNCALIBRATED

    def test_initializes_after_enough_samples(self):
        engine = CalibrationEngine("TEST")
        rng = np.random.default_rng(42)
        for i in range(300):
            engine.process_sample(
                20.0 + rng.normal(0, 0.5),
                -5.0 + rng.normal(0, 0.5),
                40.0 + rng.normal(0, 0.5),
                timestamp=float(i),
            )
        state = engine.get_state()
        assert state.status != CalibrationStatus.UNCALIBRATED
        assert state.quality > 0.0

    def test_returns_calibrated_values(self):
        engine = CalibrationEngine("TEST")
        cx, cy, cz, state = engine.process_sample(20.0, -5.0, 40.0, timestamp=0.0)
        # Before calibration computed, returns raw values
        mag = math.sqrt(cx**2 + cy**2 + cz**2)
        assert mag > 0

    def test_reset_clears_state(self):
        engine = CalibrationEngine("TEST")
        for i in range(50):
            engine.process_sample(20.0, -5.0, 40.0, timestamp=float(i))
        engine.reset()
        assert engine.status == CalibrationStatus.UNCALIBRATED
        assert engine.sample_count == 0
