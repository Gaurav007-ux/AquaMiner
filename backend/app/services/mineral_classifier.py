"""
AquaYantra — Seabed Mineral Classifier & Prospectivity Heatmap Service.

Classifies seabed sensor measurements into distinct mineral deposit signatures:
- POLYMETALLIC_NODULES (Fe-Mn-Ni-Cu-Co abyssal deposits)
- MASSIVE_SULFIDES (Hydrothermal SMS deposits: Cu-Zn-Au-Ag)
- COBALT_CRUSTS (Cobalt-rich ferromanganese seamount crusts)
- FERROMAGNETIC_ANOMALY (General metallic / mineralized anomaly)
- BACKGROUND (Standard seabed background)
"""

from __future__ import annotations

import math
from typing import Any
from app.schemas.detection import MineralHeatmapPoint


def classify_mineral_signature(
    anomaly_score: float,
    mag_deviation: float | None = None,
    temperature: float | None = None,
    turbidity: float | None = None,
    ph: float | None = None,
    tds: float | None = None,
    depth: float | None = None,
    ambient_temp: float = 20.0,
) -> tuple[str, float]:
    """
    Classifies sensor signature into mineral prospectivity type and confidence.

    Returns:
        (mineral_type, confidence)
    """
    dev = abs(mag_deviation) if mag_deviation is not None else 0.0
    temp_delta = (temperature - ambient_temp) if temperature is not None else 0.0
    turb = turbidity if turbidity is not None else 0.0
    ph_val = ph if ph is not None else 7.8
    tds_val = tds if tds is not None else 300.0

    # If anomaly score is low and magnetic deviation is minimal -> BACKGROUND
    if anomaly_score < 0.40 and dev < 1.2:
        return "BACKGROUND", max(0.5, 1.0 - anomaly_score)

    # 1. Hydrothermal Seafloor Massive Sulfides (SMS)
    # Characterized by elevated temperature (hydrothermal plume) combined with high turbidity or acidic pH
    if (temp_delta >= 2.0 and turb >= 30.0) or (turb >= 50.0 and ph_val < 6.8):
        conf = min(0.98, 0.65 + (temp_delta * 0.08) + (turb / 500.0) + (anomaly_score * 0.2))
        return "MASSIVE_SULFIDES", round(conf, 2)


    # 2. Cobalt-Rich Ferromanganese Crusts
    # Characterized by significant magnetic deviation + high conductivity / TDS
    if dev >= 2.5 and tds_val >= 600.0:
        conf = min(0.95, 0.70 + (dev / 30.0) + (anomaly_score * 0.2))
        return "COBALT_CRUSTS", round(conf, 2)

    # 3. Polymetallic Nodules
    # Characterized by strong magnetic deviation with normal pH and clear water
    if dev >= 2.0 and ph_val >= 7.2 and turb < 80.0:
        conf = min(0.96, 0.68 + (dev / 25.0) + (anomaly_score * 0.2))
        return "POLYMETALLIC_NODULES", round(conf, 2)

    # 4. General Ferromagnetic Anomaly
    if anomaly_score >= 0.60 or dev >= 1.5:
        conf = min(0.92, 0.60 + (anomaly_score * 0.3))
        return "FERROMAGNETIC_ANOMALY", round(conf, 2)

    return "BACKGROUND", 0.70


def generate_heatmap_points(
    readings: list[dict[str, Any]],
    grid_size: int = 100,
) -> list[MineralHeatmapPoint]:
    """
    Converts survey points with GPS coordinates into normalized mineral heatmap points.
    """
    heatmap_points: list[MineralHeatmapPoint] = []

    for r in readings:
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is None or lon is None:
            continue

        anomaly_score = float(r.get("anomaly_score") or 0.0)
        mag_dev = r.get("magnetic_deviation")
        if mag_dev is None and r.get("mag_x") is not None:
            mag_x = float(r.get("mag_x", 0))
            mag_y = float(r.get("mag_y", 0))
            mag_z = float(r.get("mag_z", 0))
            mag_dev = abs(math.sqrt(mag_x**2 + mag_y**2 + mag_z**2) - 45.0)

        temp = r.get("temperature")
        turb = r.get("turbidity")
        ph = r.get("ph")
        tds = r.get("tds")
        depth = r.get("depth")

        mineral_type, conf = classify_mineral_signature(
            anomaly_score=anomaly_score,
            mag_deviation=mag_dev,
            temperature=temp,
            turbidity=turb,
            ph=ph,
            tds=tds,
            depth=depth,
        )

        # Compute normalized intensity [0.0 - 1.0]
        # Weighted by anomaly score and mineral-specific factors
        intensity = min(1.0, max(0.1, anomaly_score * 0.7 + (abs(mag_dev or 0) / 20.0) * 0.3))
        if mineral_type == "BACKGROUND":
            intensity = min(0.3, intensity * 0.5)

        heatmap_points.append(
            MineralHeatmapPoint(
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                intensity=round(intensity, 3),
                mineral_type=mineral_type,
                confidence=conf,
                anomaly_score=round(anomaly_score, 3),
                depth=depth,
                magnetic_deviation=round(mag_dev, 2) if mag_dev is not None else None,
                turbidity=round(turb, 1) if turb is not None else None,
                temperature_delta=round(temp - 20.0, 2) if temp is not None else None,
                ph=round(ph, 2) if ph is not None else None,
                timestamp=r.get("timestamp"),
            )
        )

    return heatmap_points
