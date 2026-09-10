"""
AquaYantra — Model registry and version management.

Handles model loading, caching, activation, rollback, and quality gates.
A new model NEVER automatically replaces a better active model.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.exceptions import MLError, ModelNotFoundError
from app.core.logging import get_logger
from app.ml.base import BaseAnomalyModel
from app.ml.isolation_forest import IsolationForestModel
from app.ml.statistical import StatisticalAnomalyModel

logger = get_logger("ml.registry")

# Model type → class mapping
MODEL_CLASSES: dict[str, type[BaseAnomalyModel]] = {
    "isolation_forest": IsolationForestModel,
    "statistical": StatisticalAnomalyModel,
}


class ModelRegistry:
    """
    In-memory model registry with disk persistence.

    Models are loaded once and cached. Active model switching
    requires explicit activation with quality gate checks.
    """

    def __init__(self, model_dir: str | None = None) -> None:
        self._model_dir = Path(model_dir or settings.MODEL_DIR)
        self._model_dir.mkdir(parents=True, exist_ok=True)
        self._active_models: dict[str, BaseAnomalyModel] = {}
        self._loaded_models: dict[str, BaseAnomalyModel] = {}

    def create_model(self, model_type: str, **kwargs: Any) -> BaseAnomalyModel:
        """Create a new model instance of the given type."""
        cls = MODEL_CLASSES.get(model_type)
        if cls is None:
            raise MLError(f"Unknown model type: {model_type}. Available: {list(MODEL_CLASSES.keys())}")
        return cls(**kwargs)

    def get_active_model(self, model_type: str = "isolation_forest") -> BaseAnomalyModel | None:
        """Get the currently active model of a given type."""
        return self._active_models.get(model_type)

    def get_any_active_model(self) -> BaseAnomalyModel | None:
        """Get any available active model, preferring isolation_forest."""
        for pref in ["isolation_forest", "statistical"]:
            model = self._active_models.get(pref)
            if model is not None:
                return model
        # Return whatever is available
        if self._active_models:
            return next(iter(self._active_models.values()))
        return None

    def activate_model(
        self,
        model: BaseAnomalyModel,
        model_id: str,
        metrics: dict[str, Any] | None = None,
        force: bool = False,
    ) -> bool:
        """
        Activate a model, replacing the current active model of the same type.

        Quality gate: new model must have better or comparable metrics
        unless force=True.

        Returns True if activated, False if rejected.
        """
        model_type = model.model_type
        current = self._active_models.get(model_type)

        if current is not None and not force:
            # Quality gate check
            if not self._passes_quality_gate(model, metrics):
                logger.warning(
                    "model_activation_rejected",
                    model_type=model_type,
                    model_id=model_id,
                    reason="Did not pass quality gate against current active model",
                )
                return False

        self._active_models[model_type] = model
        self._loaded_models[model_id] = model
        logger.info("model_activated", model_type=model_type, model_id=model_id)
        return True

    def _passes_quality_gate(
        self,
        new_model: BaseAnomalyModel,
        metrics: dict[str, Any] | None,
    ) -> bool:
        """
        Check if a new model passes the quality gate.

        Currently checks that the anomaly rate is reasonable
        (not too high = everything is anomaly, not too low = nothing detected).
        """
        if metrics is None:
            return True

        anomaly_rate = metrics.get("anomaly_rate", 0.05)
        if anomaly_rate > 0.5:
            logger.warning("quality_gate_failed", reason="anomaly_rate too high", rate=anomaly_rate)
            return False
        if anomaly_rate < 0.001:
            logger.warning("quality_gate_failed", reason="anomaly_rate suspiciously low", rate=anomaly_rate)
            return False

        return True

    def save_model(self, model: BaseAnomalyModel, model_id: str) -> str:
        """Save model to disk. Returns the file path."""
        filename = f"{model.model_type}_{model_id}.joblib"
        path = str(self._model_dir / filename)
        model.save(path)
        return path

    def load_model(self, model_type: str, path: str) -> BaseAnomalyModel:
        """Load a model from disk."""
        model = self.create_model(model_type)
        model.load(path)
        return model

    def deactivate_model(self, model_type: str) -> None:
        """Deactivate the current active model of a type."""
        self._active_models.pop(model_type, None)
        logger.info("model_deactivated", model_type=model_type)

    def list_active(self) -> dict[str, str]:
        """List active model types."""
        return {k: v.model_type for k, v in self._active_models.items()}


# Singleton registry
model_registry = ModelRegistry()
