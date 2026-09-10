"""
AquaYantra — Sensor adapter framework.

Common interface for all sensor types. Adding a new sensor requires
creating a new adapter — NOT rewriting the pipeline.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any


@dataclass
class SensorRange:
    """Valid range for a sensor reading."""
    min_value: float
    max_value: float
    unit: str


class SensorAdapter(abc.ABC):
    """Abstract sensor adapter interface."""

    sensor_type: str = "base"

    @abc.abstractmethod
    def validate(self, value: float | None) -> bool:
        """Check if a value is within the sensor's valid range."""

    @abc.abstractmethod
    def normalize(self, value: float) -> float:
        """Normalize a raw value to standard units."""

    @abc.abstractmethod
    def get_range(self) -> SensorRange:
        """Return the expected range for this sensor."""

    def get_info(self) -> dict[str, Any]:
        return {"sensor_type": self.sensor_type, "range": self.get_range().__dict__}


class MagnetometerAdapter(SensorAdapter):
    sensor_type = "magnetometer"

    def __init__(self, min_ut: float = -800.0, max_ut: float = 800.0) -> None:
        self._min = min_ut
        self._max = max_ut

    def validate(self, value: float | None) -> bool:
        if value is None:
            return False
        return self._min <= value <= self._max

    def normalize(self, value: float) -> float:
        return value  # Already in µT

    def get_range(self) -> SensorRange:
        return SensorRange(self._min, self._max, "µT")


class TurbidityAdapter(SensorAdapter):
    sensor_type = "turbidity"

    def __init__(self, min_ntu: float = 0.0, max_ntu: float = 4000.0) -> None:
        self._min = min_ntu
        self._max = max_ntu

    def validate(self, value: float | None) -> bool:
        if value is None:
            return False
        return self._min <= value <= self._max

    def normalize(self, value: float) -> float:
        return value  # NTU

    def get_range(self) -> SensorRange:
        return SensorRange(self._min, self._max, "NTU")


class PressureAdapter(SensorAdapter):
    sensor_type = "pressure"

    def __init__(self, min_hpa: float = 300.0, max_hpa: float = 1200.0) -> None:
        self._min = min_hpa
        self._max = max_hpa

    def validate(self, value: float | None) -> bool:
        if value is None:
            return False
        return self._min <= value <= self._max

    def normalize(self, value: float) -> float:
        return value  # hPa

    def get_range(self) -> SensorRange:
        return SensorRange(self._min, self._max, "hPa")

    def to_depth_meters(self, pressure_hpa: float, surface_pressure: float = 1013.25) -> float:
        """Convert pressure to approximate depth in meters of seawater."""
        pressure_diff = pressure_hpa - surface_pressure
        return max(0.0, pressure_diff * 0.01019716)


class GPSSourceAdapter(SensorAdapter):
    sensor_type = "gps"

    def validate(self, value: float | None) -> bool:
        return value is not None

    def normalize(self, value: float) -> float:
        return value

    def get_range(self) -> SensorRange:
        return SensorRange(-180.0, 180.0, "degrees")

    def validate_coordinates(self, lat: float | None, lon: float | None) -> bool:
        if lat is None or lon is None:
            return False
        return -90 <= lat <= 90 and -180 <= lon <= 180


class SensorRegistry:
    """Registry of available sensor adapters."""

    def __init__(self) -> None:
        self._adapters: dict[str, SensorAdapter] = {}
        # Register built-in adapters
        self.register(MagnetometerAdapter())
        self.register(TurbidityAdapter())
        self.register(PressureAdapter())
        self.register(GPSSourceAdapter())

    def register(self, adapter: SensorAdapter) -> None:
        self._adapters[adapter.sensor_type] = adapter

    def get(self, sensor_type: str) -> SensorAdapter | None:
        return self._adapters.get(sensor_type)

    def list_types(self) -> list[str]:
        return list(self._adapters.keys())


sensor_registry = SensorRegistry()
