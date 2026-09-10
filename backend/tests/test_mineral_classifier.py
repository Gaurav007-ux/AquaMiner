"""
AquaYantra — Mineral Classifier & Heatmap Generation Unit Tests.
"""

from app.services.mineral_classifier import classify_mineral_signature, generate_heatmap_points


def test_classify_background():
    sig, conf = classify_mineral_signature(anomaly_score=0.15, mag_deviation=0.3)
    assert sig == "BACKGROUND"
    assert conf >= 0.5


def test_classify_polymetallic_nodules():
    sig, conf = classify_mineral_signature(
        anomaly_score=0.75,
        mag_deviation=4.5,
        temperature=20.2,
        turbidity=15.0,
        ph=7.9,
    )
    assert sig == "POLYMETALLIC_NODULES"
    assert conf >= 0.7


def test_classify_massive_sulfides():
    sig, conf = classify_mineral_signature(
        anomaly_score=0.82,
        mag_deviation=3.0,
        temperature=23.5,  # +3.5 deg C above ambient
        turbidity=120.0,
        ph=6.4,
    )
    assert sig == "MASSIVE_SULFIDES"
    assert conf >= 0.7


def test_classify_cobalt_crusts():
    sig, conf = classify_mineral_signature(
        anomaly_score=0.70,
        mag_deviation=3.8,
        tds=850.0,
    )
    assert sig == "COBALT_CRUSTS"
    assert conf >= 0.7


def test_generate_heatmap_points():
    sample_readings = [
        {"latitude": 15.421, "longitude": 73.812, "anomaly_score": 0.85, "magnetic_deviation": 5.0, "temperature": 21.0, "ph": 8.0, "turbidity": 10.0},
        {"latitude": 15.422, "longitude": 73.813, "anomaly_score": 0.10, "magnetic_deviation": 0.2, "temperature": 20.0, "ph": 7.8, "turbidity": 5.0},
        {"latitude": 15.423, "longitude": 73.814, "anomaly_score": 0.90, "magnetic_deviation": 3.0, "temperature": 24.5, "ph": 6.2, "turbidity": 90.0},
    ]
    points = generate_heatmap_points(sample_readings)
    assert len(points) == 3
    assert points[0].mineral_type == "POLYMETALLIC_NODULES"
    assert points[1].mineral_type == "BACKGROUND"
    assert points[2].mineral_type == "MASSIVE_SULFIDES"
    assert points[0].intensity > points[1].intensity
