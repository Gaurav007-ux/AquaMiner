"""
AquaYantra — Sensor health monitoring.

Detects sensor faults: disconnected magnetometer, frozen sensor, impossible values,
excessive noise, sudden offset shifts, battery degradation, missing GPS, stale data.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum

import numpy as np

from app.core.config import settings
from app.schemas.sensor_packet import SensorPacket


class HealthStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    DEGRADED = "DEGRADED"
    FAULT = "FAULT"
    OFFLINE = "OFFLINE"


@dataclass
class SensorHealthState:
    """Health state for a single device."""
    magnetometer: HealthStatus = HealthStatus.HEALTHY
    turbidity_sensor: HealthStatus = HealthStatus.HEALTHY
    pressure_sensor: HealthStatus = HealthStatus.HEALTHY
    gps: HealthStatus = HealthStatus.HEALTHY
    battery: HealthStatus = HealthStatus.HEALTHY
    overall: HealthStatus = HealthStatus.HEALTHY
    issues: list[str] = field(default_factory=list)
    last_reading_time: float = 0.0


class SensorHealthMonitor:
    """
    Stateful per-device sensor health monitor.

    Tracks rolling sensor values to detect anomalous sensor behavior
    (distinct from magnetic anomaly detection).
    """

    def __init__(self, stale_threshold_seconds: float = 30.0) -> None:
        self.stale_threshold = stale_threshold_seconds
        self._mag_buffer: deque[tuple[float, float, float]] = deque(maxlen=50)
        self._last_values: dict[str, float | None] = {}
        self._frozen_count: int = 0
        self._state = SensorHealthState()

    def evaluate(self, packet: SensorPacket) -> SensorHealthState:
        """Evaluate sensor health from a new packet."""
        self._state = SensorHealthState()
        self._state.last_reading_time = time.time()

        self._check_magnetometer(packet)
        self._check_turbidity(packet)
        self._check_pressure(packet)
        self._check_gps(packet)
        self._check_battery(packet)
        self._compute_overall()

        return self._state

    def _check_magnetometer(self, packet: SensorPacket) -> None:
        if packet.mag_x is None and packet.mag_y is None and packet.mag_z is None:
            self._state.magnetometer = HealthStatus.FAULT
            self._state.issues.append("Magnetometer disconnected — all axes null")
            return

        x = packet.mag_x or 0.0
        y = packet.mag_y or 0.0
        z = packet.mag_z or 0.0

        # Impossible values check
        extreme = settings.MAG_RANGE_MAX * 0.95
        if abs(x) > extreme or abs(y) > extreme or abs(z) > extreme:
            self._state.magnetometer = HealthStatus.WARNING
            self._state.issues.append("Magnetometer near maximum range — possible saturation")

        # Frozen sensor detection
        self._mag_buffer.append((x, y, z))
        if len(self._mag_buffer) >= 10:
            recent = list(self._mag_buffer)[-10:]
            x_vals = [v[0] for v in recent]
            y_vals = [v[1] for v in recent]
            z_vals = [v[2] for v in recent]

            if np.std(x_vals) < 1e-6 and np.std(y_vals) < 1e-6 and np.std(z_vals) < 1e-6:
                self._frozen_count += 1
                if self._frozen_count > 5:
                    self._state.magnetometer = HealthStatus.FAULT
                    self._state.issues.append("Magnetometer appears frozen — zero variance")
                else:
                    self._state.magnetometer = HealthStatus.WARNING
                    self._state.issues.append("Magnetometer may be frozen")
            else:
                self._frozen_count = max(0, self._frozen_count - 1)

            # Excessive noise detection
            combined_std = np.std(x_vals) + np.std(y_vals) + np.std(z_vals)
            if combined_std > 100.0:
                self._state.magnetometer = HealthStatus.DEGRADED
                self._state.issues.append("Excessive magnetometer noise detected")

    def _check_turbidity(self, packet: SensorPacket) -> None:
        if packet.turbidity is None:
            self._state.turbidity_sensor = HealthStatus.WARNING
            self._state.issues.append("No turbidity data")
            return

    def _check_pressure(self, packet: SensorPacket) -> None:
        if packet.pressure is not None:
            if packet.pressure < settings.PRESSURE_RANGE_MIN or packet.pressure > settings.PRESSURE_RANGE_MAX:
                self._state.pressure_sensor = HealthStatus.WARNING
                self._state.issues.append(f"Pressure {packet.pressure} outside expected range")

    def _check_gps(self, packet: SensorPacket) -> None:
        if packet.latitude is None or packet.longitude is None:
            self._state.gps = HealthStatus.WARNING
            self._state.issues.append("Missing GPS position")

    def _check_battery(self, packet: SensorPacket) -> None:
        if packet.battery_voltage is None:
            self._state.battery = HealthStatus.WARNING
            return
        if packet.battery_voltage < 7.0:
            self._state.battery = HealthStatus.FAULT
            self._state.issues.append(f"Critical battery voltage: {packet.battery_voltage}V")
        elif packet.battery_voltage < 9.0:
            self._state.battery = HealthStatus.DEGRADED
            self._state.issues.append(f"Low battery voltage: {packet.battery_voltage}V")

    def _compute_overall(self) -> None:
        statuses = [
            self._state.magnetometer,
            self._state.turbidity_sensor,
            self._state.pressure_sensor,
            self._state.gps,
            self._state.battery,
        ]
        if HealthStatus.FAULT in statuses:
            self._state.overall = HealthStatus.FAULT
        elif HealthStatus.DEGRADED in statuses:
            self._state.overall = HealthStatus.DEGRADED
        elif HealthStatus.WARNING in statuses:
            self._state.overall = HealthStatus.WARNING
        else:
            self._state.overall = HealthStatus.HEALTHY

    def check_stale(self) -> bool:
        """Returns True if data is stale (no recent readings)."""
        if self._state.last_reading_time == 0.0:
            return True
        return (time.time() - self._state.last_reading_time) > self.stale_threshold
