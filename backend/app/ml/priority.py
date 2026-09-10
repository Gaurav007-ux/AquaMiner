"""
AquaYantra — Target prioritization scoring.

Computes exploration priority (LOW / MEDIUM / HIGH / VERY_HIGH)
from anomaly strength, confidence, persistence, spatial concentration,
repeated observations, and data quality.

This is a PRIORITY SCORE, not a mineral identification claim.
"""

from __future__ import annotations

from enum import Enum


class Priority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


def compute_priority(
    anomaly_strength: float,
    confidence: float,
    persistence_samples: int,
    observation_count: int = 1,
    data_quality: float = 1.0,
    spatial_concentration: float = 0.0,
) -> Priority:
    """
    Compute exploration priority for a target candidate.

    All inputs normalized to 0–1 (except counts).
    """
    # Weighted score
    score = (
        0.30 * min(anomaly_strength, 1.0)
        + 0.25 * confidence
        + 0.15 * min(persistence_samples / 20.0, 1.0)
        + 0.10 * min(observation_count / 10.0, 1.0)
        + 0.10 * data_quality
        + 0.10 * min(spatial_concentration, 1.0)
    )

    if score >= 0.75:
        return Priority.VERY_HIGH
    elif score >= 0.55:
        return Priority.HIGH
    elif score >= 0.35:
        return Priority.MEDIUM
    else:
        return Priority.LOW
