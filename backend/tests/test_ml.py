"""
AquaYantra — ML model tests.

Tests Isolation Forest, statistical model, confidence engine,
and temporal detection independently.
"""

import numpy as np
import pytest

from app.ml.confidence import ConfidenceEngine
from app.ml.isolation_forest import IsolationForestModel
from app.ml.statistical import StatisticalAnomalyModel
from app.ml.temporal import DetectionState, TemporalDetector
from app.ml.explainability import ExplainabilityEngine
from app.ml.base import AnomalyResult
from app.ml.priority import Priority, compute_priority


class TestIsolationForest:
    def _make_trained_model(self) -> IsolationForestModel:
        model = IsolationForestModel(n_estimators=50, contamination=0.05)
        rng = np.random.default_rng(42)
        bg = rng.normal(0, 1, (600, 18))
        model.fit(bg)
        return model

    def test_fit_returns_metrics(self):
        model = self._make_trained_model()
        assert model.is_fitted

    def test_background_scored_low(self):
        model = self._make_trained_model()
        bg_sample = np.zeros(18)
        result = model.predict(bg_sample)
        assert result.anomaly_score < 0.7

    def test_anomaly_scored_high(self):
        model = self._make_trained_model()
        anomaly = np.ones(18) * 10.0
        result = model.predict(anomaly)
        assert result.anomaly_score > 0.3

    def test_feature_contributions_returned(self):
        model = self._make_trained_model()
        result = model.predict(np.zeros(18))
        assert len(result.feature_contributions) > 0

    def test_batch_prediction(self):
        model = self._make_trained_model()
        batch = np.random.default_rng(42).normal(0, 1, (10, 18))
        results = model.predict_batch(batch)
        assert len(results) == 10

    def test_min_samples_enforced(self):
        model = IsolationForestModel()
        with pytest.raises(ValueError, match="Need at least"):
            model.fit(np.zeros((10, 18)))


class TestStatisticalModel:
    def test_fit_and_predict(self):
        model = StatisticalAnomalyModel()
        bg = np.random.default_rng(42).normal(0, 1, (200, 18))
        model.fit(bg)

        # Normal sample
        result = model.predict(np.zeros(18))
        assert result.anomaly_score < 0.6

        # Extreme sample
        result = model.predict(np.ones(18) * 10.0)
        assert result.anomaly_score > 0.3


class TestConfidenceEngine:
    def test_perfect_conditions_high_confidence(self):
        ce = ConfidenceEngine()
        conf = ce.compute(
            sensor_quality=1.0,
            signal_strength=0.9,
            model_score=0.85,
            persistence=0.8,
            calibration_quality=0.9,
            environmental_consistency=1.0,
        )
        assert conf > 0.8

    def test_poor_conditions_low_confidence(self):
        ce = ConfidenceEngine()
        conf = ce.compute(
            sensor_quality=0.2,
            signal_strength=0.1,
            model_score=0.1,
            persistence=0.0,
            calibration_quality=0.1,
            environmental_consistency=0.3,
        )
        assert conf < 0.3

    def test_confidence_differs_from_anomaly_score(self):
        """Confidence ≠ anomaly score."""
        ce = ConfidenceEngine()
        # High anomaly but low quality → low confidence
        conf = ce.compute(
            sensor_quality=0.1,
            signal_strength=0.9,
            model_score=0.9,
            persistence=0.0,
            calibration_quality=0.1,
        )
        assert conf < 0.7, "Low quality should reduce confidence even with high signal"


class TestTemporalDetector:
    def test_idle_state_on_init(self):
        td = TemporalDetector()
        assert td.state == DetectionState.IDLE

    def test_transitions_through_states(self):
        td = TemporalDetector(
            watch_threshold=0.4,
            trigger_threshold=0.6,
            confirmation_threshold=0.7,
            min_persistence=2,
        )

        td.process(anomaly_score=0.5, timestamp=1.0)
        assert td.state == DetectionState.WATCH

        td.process(anomaly_score=0.7, timestamp=2.0)
        assert td.state == DetectionState.CANDIDATE

    def test_cooldown_after_event(self):
        td = TemporalDetector(
            watch_threshold=0.3,
            trigger_threshold=0.5,
            confirmation_threshold=0.6,
            min_persistence=2,
            cooldown_samples=3,
        )
        for i in range(10):
            td.process(anomaly_score=0.8, timestamp=float(i))
        td.process(anomaly_score=0.1, timestamp=10.0)

        assert td.state == DetectionState.COOLDOWN


class TestExplainability:
    def test_explanation_for_background(self):
        engine = ExplainabilityEngine()
        result = AnomalyResult(anomaly_score=0.1, is_anomaly=False)
        explanation = engine.explain(result)
        assert explanation["prediction"] == "BACKGROUND"
        assert "background" in explanation["reasons"][0].lower()

    def test_explanation_for_anomaly(self):
        engine = ExplainabilityEngine()
        result = AnomalyResult(
            anomaly_score=0.85, is_anomaly=True,
            feature_contributions={"baseline_deviation": 0.5, "signal_to_noise": 0.3}
        )
        explanation = engine.explain(result, confidence=0.8, calibration_quality=0.9, persistence_samples=5)
        assert explanation["prediction"] in ("POTENTIAL_TARGET", "ANOMALY_DETECTED")
        assert len(explanation["reasons"]) > 0


class TestPriority:
    def test_very_high_priority(self):
        p = compute_priority(
            anomaly_strength=0.95, confidence=0.9, persistence_samples=20,
            observation_count=10, data_quality=0.95, spatial_concentration=0.8,
        )
        assert p == Priority.VERY_HIGH

    def test_low_priority(self):
        p = compute_priority(
            anomaly_strength=0.1, confidence=0.2, persistence_samples=1,
        )
        assert p == Priority.LOW
