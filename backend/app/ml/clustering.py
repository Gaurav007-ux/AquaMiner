"""
AquaYantra — Target clustering using DBSCAN on detection event locations.

Groups nearby detection events into target candidates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.cluster import DBSCAN

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("ml.clustering")


@dataclass
class TargetCluster:
    """A clustered target candidate from multiple detection events."""
    cluster_id: int
    center_lat: float
    center_lon: float
    observation_count: int
    peak_anomaly_score: float
    mean_anomaly_score: float
    mean_confidence: float
    spatial_extent_meters: float
    depth_range: tuple[float, float] | None
    event_ids: list[str]


class TargetClusterer:
    """
    Clusters detection events by geographic proximity using DBSCAN.

    Multiple nearby anomaly events become a single target candidate.
    """

    def __init__(
        self,
        eps_meters: float | None = None,
        min_samples: int | None = None,
    ) -> None:
        self.eps_meters = eps_meters or settings.CLUSTER_EPS_METERS
        self.min_samples = min_samples or settings.CLUSTER_MIN_SAMPLES

    def cluster(
        self,
        events: list[dict[str, Any]],
    ) -> list[TargetCluster]:
        """
        Cluster detection events by location.

        Each event dict must have: lat, lon, anomaly_score, confidence, depth (optional), id.
        """
        if len(events) < self.min_samples:
            return []

        coords = np.array([[e["lat"], e["lon"]] for e in events])
        # Convert degrees to approximate meters for DBSCAN
        coords_meters = coords.copy()
        coords_meters[:, 0] *= 111320  # lat deg → meters
        coords_meters[:, 1] *= 111320 * np.cos(np.radians(np.mean(coords[:, 0])))

        db = DBSCAN(eps=self.eps_meters, min_samples=self.min_samples)
        labels = db.fit_predict(coords_meters)

        clusters: list[TargetCluster] = []
        for label in set(labels):
            if label == -1:  # Noise
                continue
            mask = labels == label
            cluster_events = [e for e, m in zip(events, mask) if m]
            cluster_coords = coords[mask]

            depths = [e.get("depth") for e in cluster_events if e.get("depth") is not None]
            depth_range = (min(depths), max(depths)) if depths else None

            # Spatial extent
            extent = 0.0
            if len(cluster_coords) > 1:
                from scipy.spatial.distance import pdist
                dists_m = pdist(coords_meters[mask])
                extent = float(np.max(dists_m)) if len(dists_m) > 0 else 0.0

            clusters.append(TargetCluster(
                cluster_id=int(label),
                center_lat=float(np.mean(cluster_coords[:, 0])),
                center_lon=float(np.mean(cluster_coords[:, 1])),
                observation_count=len(cluster_events),
                peak_anomaly_score=float(max(e["anomaly_score"] for e in cluster_events)),
                mean_anomaly_score=float(np.mean([e["anomaly_score"] for e in cluster_events])),
                mean_confidence=float(np.mean([e["confidence"] for e in cluster_events])),
                spatial_extent_meters=extent,
                depth_range=depth_range,
                event_ids=[str(e.get("id", "")) for e in cluster_events],
            ))

        logger.info("clustering_complete", n_events=len(events), n_clusters=len(clusters))
        return clusters
