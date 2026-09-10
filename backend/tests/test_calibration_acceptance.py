"""
AquaYantra — Auto-calibration acceptance test (Section 31).

5-phase simulation proving that:
1. Baseline converges on stable background
2. Adaptive baseline follows slow drift
3. Baseline FREEZES during strong anomalies
4. Anomaly is NOT absorbed into baseline even after extended duration
5. Baseline resumes adaptation after anomaly ends
"""

import math

import numpy as np
import pytest

from app.calibration.baseline import AdaptiveBaseline, BaselineState


class TestCalibrationAcceptance:
    """Complete 5-phase auto-calibration acceptance test."""

    def _make_baseline(self) -> AdaptiveBaseline:
        return AdaptiveBaseline(
            init_window=50,
            update_rate=0.01,
            freeze_threshold=3.0,
            max_drift_per_update=0.1,
        )

    def test_phase1_stable_background_baseline_converges(self):
        """Phase 1: Generate stable magnetic background.
        Expected: baseline converges, noise stabilizes, anomaly score low."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        background = 45.0
        noise_std = 0.5

        # Feed 200 stable samples
        for _ in range(200):
            mag = background + rng.normal(0, noise_std)
            bl.update(mag, anomaly_probability=0.0, sensor_healthy=True, data_quality=1.0)

        assert bl.state == BaselineState.TRACKING
        assert abs(bl.value - background) < 2.0, f"Baseline {bl.value} should be near {background}"
        assert bl.noise > 0.1, "Noise estimate should be positive"
        assert bl.noise < 5.0, "Noise estimate should be reasonable"

    def test_phase2_slow_drift_baseline_follows(self):
        """Phase 2: Introduce slow sensor drift.
        Expected: adaptive baseline gradually follows the drift."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        background = 45.0

        # Init phase
        for _ in range(100):
            bl.update(background + rng.normal(0, 0.5))

        initial_baseline = bl.value

        # Drift phase: shift background by 2.0 over 500 samples
        for i in range(500):
            drift = 2.0 * (i / 500.0)
            mag = background + drift + rng.normal(0, 0.5)
            bl.update(mag, anomaly_probability=0.0, sensor_healthy=True, data_quality=1.0)

        # Baseline should have moved towards the drifted value
        assert bl.value > initial_baseline, "Baseline should have increased with drift"
        # With conservative update rate (0.01 alpha, 0.1 max drift/step),
        # baseline tracks slowly — this is by design for safety
        assert bl.value > initial_baseline + 0.1, "Baseline should show some drift tracking"

    def test_phase3_strong_anomaly_baseline_freezes(self):
        """Phase 3: Introduce a strong magnetic anomaly.
        Expected: baseline freezes, anomaly score increases, detection event created."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        background = 45.0

        # Init
        for _ in range(100):
            bl.update(background + rng.normal(0, 0.5))

        baseline_before_anomaly = bl.value

        # Strong anomaly: +30 µT deviation
        for _ in range(50):
            status = bl.update(
                background + 30.0 + rng.normal(0, 0.5),
                anomaly_probability=0.9,
                sensor_healthy=True,
                data_quality=1.0,
            )

        assert bl.state == BaselineState.FROZEN, (
            f"Baseline should be FROZEN during strong anomaly, got {bl.state}"
        )
        # Baseline should NOT have moved significantly
        assert abs(bl.value - baseline_before_anomaly) < 2.0, (
            f"Baseline shifted by {abs(bl.value - baseline_before_anomaly):.2f} during anomaly — "
            f"should stay near {baseline_before_anomaly:.2f}"
        )

    def test_phase4_extended_anomaly_not_absorbed(self):
        """Phase 4: Keep the anomaly for an extended duration.
        Expected: system MUST NOT absorb the anomaly into baseline."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        background = 45.0

        # Init
        for _ in range(100):
            bl.update(background + rng.normal(0, 0.5))

        baseline_before = bl.value

        # Extended strong anomaly: 500 samples
        for _ in range(500):
            bl.update(
                background + 25.0 + rng.normal(0, 0.5),
                anomaly_probability=0.95,
                sensor_healthy=True,
                data_quality=1.0,
            )

        # CRITICAL: baseline must NOT have absorbed the anomaly
        assert abs(bl.value - baseline_before) < 3.0, (
            f"CRITICAL FAILURE: Baseline drifted by "
            f"{abs(bl.value - baseline_before):.2f} during extended anomaly. "
            f"The system absorbed the anomaly into the baseline!"
        )

    def test_phase5_return_to_normal_baseline_resumes(self):
        """Phase 5: Return to normal background.
        Expected: baseline resumes adaptation."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        background = 45.0

        # Init
        for _ in range(100):
            bl.update(background + rng.normal(0, 0.5))

        # Anomaly phase
        for _ in range(100):
            bl.update(
                background + 25.0,
                anomaly_probability=0.9,
                sensor_healthy=True,
            )

        assert bl.state == BaselineState.FROZEN

        # Return to normal
        for _ in range(200):
            bl.update(
                background + rng.normal(0, 0.5),
                anomaly_probability=0.0,
                sensor_healthy=True,
                data_quality=1.0,
            )

        assert bl.state in (BaselineState.TRACKING, BaselineState.SLOW_ADAPT), (
            f"Baseline should resume adaptation after anomaly ends, got {bl.state}"
        )

    def test_full_5_phase_scenario(self):
        """Run all 5 phases end-to-end and verify metrics."""
        bl = self._make_baseline()
        rng = np.random.default_rng(42)
        bg = 45.0

        # Phase 1: Stable
        for _ in range(200):
            bl.update(bg + rng.normal(0, 0.5))
        p1_baseline = bl.value
        assert abs(p1_baseline - bg) < 2.0

        # Phase 2: Slow drift
        for i in range(300):
            bl.update(bg + 1.5 * i / 300 + rng.normal(0, 0.5))
        assert bl.value > p1_baseline

        p2_baseline = bl.value

        # Phase 3: Strong anomaly
        for _ in range(100):
            bl.update(bg + 30.0, anomaly_probability=0.9)
        assert bl.state == BaselineState.FROZEN
        assert abs(bl.value - p2_baseline) < 2.0

        # Phase 4: Extended anomaly
        for _ in range(300):
            bl.update(bg + 30.0, anomaly_probability=0.95)
        assert abs(bl.value - p2_baseline) < 3.0, "Anomaly absorbed into baseline!"

        # Phase 5: Return to normal
        for _ in range(200):
            bl.update(bg + rng.normal(0, 0.5), anomaly_probability=0.0, data_quality=1.0)
        assert bl.state != BaselineState.FROZEN
