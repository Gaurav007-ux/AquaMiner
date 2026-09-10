"""AquaYantra — Test configuration and fixtures."""

import pytest


@pytest.fixture
def sample_packet_data():
    """Return a valid sensor packet dict."""
    from datetime import datetime, timezone
    return {
        "device_id": "AQUAYANTRA-TEST-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sequence": 1,
        "mag_x": 20.0,
        "mag_y": -5.0,
        "mag_z": 40.0,
        "turbidity": 5.0,
        "pressure": 1013.25,
        "latitude": 28.6139,
        "longitude": 77.2090,
        "depth": 15.0,
        "battery_voltage": 12.0,
    }
