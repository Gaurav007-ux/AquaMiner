"""
AquaYantra — Processing unit tests.

Tests magnetometer calculations, filters, data quality, features,
sensor health, and the processing pipeline.
"""

import math
from datetime import datetime, timezone

import numpy as np
import pytest

from app.processing.magnetic import MagneticProcessor, compute_magnitude
from app.processing.filters import (
    ExponentialMovingAverage,
    LowPassFilter,
    MedianFilter,
    RobustRollingStatistics,
)
from app.processing.quality import DataQualityEngine, QualityResult
from app.processing.features import FeatureEngineer, FEATURE_NAMES
from app.processing.health import SensorHealthMonitor, HealthStatus
from app.schemas.sensor_packet import SensorPacket


class TestMagnitude:
    def test_zero_vector(self):
        assert compute_magnitude(0, 0, 0) == 0.0

    def test_unit_vector(self):
        assert abs(compute_magnitude(1, 0, 0) - 1.0) < 1e-10

    def test_known_vector(self):
        result = compute_magnitude(3, 4, 0)
        assert abs(result - 5.0) < 1e-10

    def test_3d_vector(self):
        result = compute_magnitude(1, 2, 2)
        assert abs(result - 3.0) < 1e-10


class TestMagneticProcessor:
    def test_rolling_statistics_update(self):
        proc = MagneticProcessor(window_size=10)
        for _ in range(20):
            proc.process(20.0, -5.0, 40.0, baseline=45.0)

        reading = proc.process(20.0, -5.0, 40.0, baseline=45.0)
        assert reading.magnitude > 0
        assert reading.rolling_mean > 0
        assert reading.rolling_std >= 0

    def test_deviation_from_baseline(self):
        proc = MagneticProcessor(window_size=10)
        reading = proc.process(20.0, -5.0, 40.0, baseline=45.0)
        assert reading.deviation == reading.magnitude - 45.0

    def test_rate_of_change(self):
        proc = MagneticProcessor()
        proc.process(20.0, -5.0, 40.0)
        reading = proc.process(22.0, -5.0, 40.0)
        assert reading.rate_of_change != 0

    def test_reset(self):
        proc = MagneticProcessor()
        proc.process(20.0, -5.0, 40.0)
        proc.reset()
        assert proc.sample_count == 0


class TestFilters:
    def test_median_filter_removes_spike(self):
        mf = MedianFilter(kernel_size=5)
        values = [10, 10, 100, 10, 10]  # Spike at index 2
        results = [mf.apply(v) for v in values]
        # Median should suppress the spike
        assert results[-1] == 10.0

    def test_ema_convergence(self):
        ema = ExponentialMovingAverage(alpha=0.5)
        for _ in range(100):
            result = ema.apply(50.0)
        assert abs(result - 50.0) < 0.01

    def test_robust_stats_outlier_detection(self):
        stats = RobustRollingStatistics(window_size=100)
        rng = np.random.default_rng(42)

        for _ in range(100):
            stats.update(rng.normal(45, 0.5))

        assert not stats.is_outlier(45.0)
        assert stats.is_outlier(60.0)  # 30 MADs above median

    def test_robust_stats_mad(self):
        stats = RobustRollingStatistics(window_size=50)
        for v in [10, 10, 10, 10, 10]:
            stats.update(v)
        assert stats.mad == 0.0
        assert stats.median == 10.0


class TestDataQuality:
    def test_perfect_packet(self):
        engine = DataQualityEngine()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            sequence=1,
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
            latitude=28.6, longitude=77.2,
            battery_voltage=12.0,
            turbidity=5.0,
        )
        result = engine.evaluate(packet, calibration_status="calibrated")
        assert result.score >= 0.85
        assert result.status == "GOOD"

    def test_missing_mag_data_penalized(self):
        engine = DataQualityEngine()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            mag_x=None, mag_y=None, mag_z=None,
        )
        result = engine.evaluate(packet)
        assert result.score < 0.7
        assert any("magnetometer" in i.lower() for i in result.issues)

    def test_low_battery_penalized(self):
        engine = DataQualityEngine()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
            battery_voltage=6.5,
        )
        result = engine.evaluate(packet)
        assert any("battery" in i.lower() for i in result.issues)

    def test_packet_gap_detected(self):
        engine = DataQualityEngine()
        p1 = SensorPacket(
            device_id="TEST", timestamp=datetime.now(timezone.utc), sequence=1,
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
        )
        engine.evaluate(p1)

        p2 = SensorPacket(
            device_id="TEST", timestamp=datetime.now(timezone.utc), sequence=10,
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
        )
        result = engine.evaluate(p2)
        assert any("gap" in i.lower() for i in result.issues)


class TestFeatureEngineer:
    def test_feature_vector_completeness(self):
        proc = MagneticProcessor()
        mag = proc.process(20.0, -5.0, 40.0, baseline=45.0)
        fe = FeatureEngineer()
        fv = fe.build(mag, depth=15.0, turbidity=5.0, battery_voltage=12.0)

        assert fv.valid
        assert len(fv.to_array()) == len(FEATURE_NAMES)
        assert fv.schema_version == "1.0"

    def test_feature_values_not_zero(self):
        proc = MagneticProcessor()
        mag = proc.process(20.0, -5.0, 40.0, baseline=45.0)
        fe = FeatureEngineer()
        fv = fe.build(mag)

        arr = fv.to_array()
        # At least magnitude should be non-zero
        assert any(v != 0.0 for v in arr)


class TestSensorHealth:
    def test_healthy_packet(self):
        monitor = SensorHealthMonitor()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
            latitude=28.6, longitude=77.2,
            battery_voltage=12.0,
        )
        state = monitor.evaluate(packet)
        assert state.overall in (HealthStatus.HEALTHY, HealthStatus.WARNING)

    def test_missing_mag_is_fault(self):
        monitor = SensorHealthMonitor()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            mag_x=None, mag_y=None, mag_z=None,
        )
        state = monitor.evaluate(packet)
        assert state.magnetometer == HealthStatus.FAULT

    def test_critical_battery_fault(self):
        monitor = SensorHealthMonitor()
        packet = SensorPacket(
            device_id="TEST",
            timestamp=datetime.now(timezone.utc),
            mag_x=20.0, mag_y=-5.0, mag_z=40.0,
            battery_voltage=6.5,
        )
        state = monitor.evaluate(packet)
        assert state.battery == HealthStatus.FAULT
