"""
AquaYantra — Base anomaly model ABC.

All anomaly detection models implement this interface so the backend
can switch models without changing the API.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class AnomalyResult:
    """Result from an anomaly model prediction."""
    anomaly_score: float = 0.0       # 0–1 how unusual the signal is
    is_anomaly: bool = False
    feature_contributions: dict[str, float] = field(default_factory=dict)
    model_type: str = ""
    model_version: int = 0
    raw_score: float = 0.0           # Model's native score before normalization


class BaseAnomalyModel(abc.ABC):
    """
    Abstract base for all anomaly detection models.

    Subclasses: IsolationForestModel, StatisticalAnomalyModel, (future) XGBoostModel.
    """

    model_type: str = "base"
    version: int = 0

    @abc.abstractmethod
    def fit(self, features: np.ndarray) -> dict[str, Any]:
        """
        Train the model on background/non-anomaly data.

        Returns training metrics.
        """

    @abc.abstractmethod
    def predict(self, features: np.ndarray) -> AnomalyResult:
        """
        Score a single feature vector.

        Returns an AnomalyResult with normalized anomaly_score in [0, 1].
        """

    @abc.abstractmethod
    def predict_batch(self, features: np.ndarray) -> list[AnomalyResult]:
        """Score a batch of feature vectors."""

    @abc.abstractmethod
    def save(self, path: str) -> None:
        """Persist the trained model to disk."""

    @abc.abstractmethod
    def load(self, path: str) -> None:
        """Load a trained model from disk."""

    @abc.abstractmethod
    def get_params(self) -> dict[str, Any]:
        """Return model parameters for serialization."""

    def get_info(self) -> dict[str, Any]:
        """Return model metadata."""
        return {
            "model_type": self.model_type,
            "version": self.version,
            "params": self.get_params(),
        }
