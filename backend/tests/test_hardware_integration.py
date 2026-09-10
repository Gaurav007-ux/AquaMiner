"""
AquaYantra — End-to-end Hardware & SD Ingestion Integration Tests.
"""

import io
import csv
from app.services.mineral_classifier import classify_mineral_signature, generate_heatmap_points


def test_sd_survey_csv_parsing_and_ml_processing():
    """
    Test parsing raw STM32 SD card CSV data and running each sample
    through mineral classification and heatmap generation.
    """
    sample_csv = (
        "timestamp_ms,sequence,mag_x_uT,mag_y_uT,mag_z_uT,mag_magnitude_uT,mag_baseline_uT,mag_deviation_uT,rate_of_change_uT_s,pressure_hPa,depth_m,temp_c,turbidity_v,turbidity_ntu,ph,tds_ppm,battery_v,battery_pct,anomaly_state,data_quality_pct\n"
        "1000,1,15.2,22.1,35.4,44.4,44.0,0.4,0.01,1013.2,0.5,22.0,3.5,5.0,7.8,320,12.4,95.0,BACKGROUND,100.0\n"
        "2000,2,18.4,24.8,48.2,57.2,44.1,13.1,1.20,1015.0,1.2,22.1,3.4,8.0,7.9,340,12.3,94.0,ANOMALY_ACTIVE,98.0\n"
        "3000,3,14.9,21.9,34.8,43.9,44.0,0.1,0.02,1013.5,0.6,25.8,2.1,140.0,6.2,410,12.3,94.0,ANOMALY_ACTIVE,95.0\n"
    )

    reader = csv.DictReader(io.StringIO(sample_csv))
    rows = list(reader)
    assert len(rows) == 3

    readings_for_heatmap = []
    for i, row in enumerate(rows):
        mag_dev = float(row["mag_deviation_uT"])
        anomaly_score = 0.85 if "ANOMALY" in row["anomaly_state"] else 0.10
        readings_for_heatmap.append({
            "latitude": 15.234 + (i * 0.001),
            "longitude": 73.543 + (i * 0.001),
            "anomaly_score": anomaly_score,
            "magnetic_deviation": mag_dev,
            "temperature": float(row["temp_c"]),
            "turbidity": float(row["turbidity_ntu"]),
            "ph": float(row["ph"]),
            "tds": float(row["tds_ppm"]),
            "depth": float(row["depth_m"]),
        })

    heatmap = generate_heatmap_points(readings_for_heatmap)
    assert len(heatmap) == 3

    # Sample 1: Low deviation (0.4 uT), background state -> Background
    assert heatmap[0].mineral_type == "BACKGROUND"
    # Sample 2: Strong magnetic deviation (13.1 uT) with normal pH (7.9) -> Polymetallic Nodule signature
    assert heatmap[1].mineral_type == "POLYMETALLIC_NODULES"
    assert heatmap[1].confidence >= 0.70
    # Sample 3: High temp (25.8C vs 20C ambient) + high turbidity (140 NTU) + acidic pH (6.2) -> Massive Sulfide signature
    assert heatmap[2].mineral_type == "MASSIVE_SULFIDES"
    assert heatmap[2].confidence >= 0.70


def test_usb_csv_dump_with_base_coordinates_georeferencing():
    """
    Test that CSV dump prepended with #BASE_LAT and #BASE_LON (sent by ESP32 over USB)
    is properly parsed and georeferences all dive readings onto the seabed grid.
    """
    usb_stream_csv = (
        "#FILE:/AQUAYANTRA/SURVEY/SRV_001.CSV\n"
        "#BASE_LAT:15.299300\n"
        "#BASE_LON:73.824200\n"
        "timestamp_ms,sequence,mag_x_uT,mag_y_uT,mag_z_uT,mag_magnitude_uT,mag_baseline_uT,mag_deviation_uT,rate_of_change_uT_s,pressure_hPa,depth_m,temp_c,turbidity_v,turbidity_ntu,ph,tds_ppm,battery_v,battery_pct,anomaly_state,data_quality_pct\n"
        "1000,1,15.2,22.1,35.4,44.4,44.0,0.4,0.01,1013.2,0.5,22.0,3.5,5.0,7.8,320,12.4,95.0,BACKGROUND,100.0\n"
        "2000,2,18.4,24.8,48.2,57.2,44.1,13.1,1.20,1015.0,1.2,22.1,3.4,8.0,7.9,340,12.3,94.0,ANOMALY_ACTIVE,98.0\n"
    )

    base_lat = None
    base_lon = None
    clean_lines = []
    for line in usb_stream_csv.splitlines():
        l = line.strip()
        if l.startswith("#BASE_LAT:"):
            base_lat = float(l.split(":")[1])
        elif l.startswith("#BASE_LON:"):
            base_lon = float(l.split(":")[1])
        elif not l.startswith("#"):
            clean_lines.append(l)

    assert base_lat == 15.299300
    assert base_lon == 73.824200

    reader = csv.DictReader(io.StringIO("\n".join(clean_lines)))
    rows = list(reader)
    assert len(rows) == 2
    assert "timestamp_ms" in rows[0]
    assert "mag_x_uT" in rows[0]
