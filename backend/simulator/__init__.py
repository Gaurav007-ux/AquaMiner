"""
AquaYantra — Realistic sensor data simulator.

Generates sensor streams matching the exact SensorPacket schema so data
flows through the SAME processing pipeline as real hardware.

Supports configurable scenarios: NORMAL_SURVEY, WEAK_ANOMALY, STRONG_ANOMALY,
MULTIPLE_TARGETS, SENSOR_DRIFT, HIGH_NOISE, PACKET_LOSS, SENSOR_FAILURE.
"""

from __future__ import annotations

import enum
import math
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterator

import numpy as np

from app.schemas.sensor_packet import SensorPacket


class Scenario(str, enum.Enum):
    NORMAL_SURVEY = "NORMAL_SURVEY"
    WEAK_ANOMALY = "WEAK_ANOMALY"
    STRONG_ANOMALY = "STRONG_ANOMALY"
    MULTIPLE_TARGETS = "MULTIPLE_TARGETS"
    SENSOR_DRIFT = "SENSOR_DRIFT"
    HIGH_NOISE = "HIGH_NOISE"
    PACKET_LOSS = "PACKET_LOSS"
    SENSOR_FAILURE = "SENSOR_FAILURE"


@dataclass
class SimulatorConfig:
    """Configuration for the simulator."""
    device_id: str = "AQUAYANTRA-SIM-001"
    scenario: Scenario = Scenario.NORMAL_SURVEY
    sample_rate_hz: float = 2.0
    duration_seconds: float = 300.0
    base_latitude: float = 28.6139
    base_longitude: float = 77.2090
    base_depth: float = 15.0
    battery_start_voltage: float = 12.6

    # Magnetic background (typical Earth's field ~ 25–65 µT)
    background_x: float = 20.0
    background_y: float = -5.0
    background_z: float = 40.0

    # Noise parameters
    mag_noise_std: float = 0.5
    turbidity_base: float = 5.0
    turbidity_noise: float = 2.0


class SimulationEngine:
    """
    Generates realistic sensor packet streams.

    The simulator produces SensorPacket objects that are indistinguishable
    (to the processing pipeline) from real hardware packets.
    """

    def __init__(self, config: SimulatorConfig | None = None) -> None:
        self.config = config or SimulatorConfig()
        self._rng = np.random.default_rng(42)
        self._sequence: int = 0
        self._time_offset: float = 0.0

    def generate(self) -> Iterator[SensorPacket]:
        """Generate a stream of sensor packets for the configured scenario."""
        dt = 1.0 / self.config.sample_rate_hz
        total_samples = int(self.config.duration_seconds * self.config.sample_rate_hz)
        start_time = time.time()

        for i in range(total_samples):
            self._sequence += 1
            t = i * dt
            self._time_offset = t

            packet = self._generate_sample(t, i, total_samples)
            if packet is not None:  # None = simulated packet loss
                yield packet

    def _generate_sample(
        self, t: float, index: int, total: int
    ) -> SensorPacket | None:
        """Generate a single sample based on scenario."""
        scenario = self.config.scenario

        # Packet loss simulation
        if scenario == Scenario.PACKET_LOSS and self._rng.random() < 0.1:
            return None

        # Base magnetic field
        mag_x = self.config.background_x
        mag_y = self.config.background_y
        mag_z = self.config.background_z

        # Add noise
        noise_std = self.config.mag_noise_std
        if scenario == Scenario.HIGH_NOISE:
            noise_std *= 10.0

        mag_x += float(self._rng.normal(0, noise_std))
        mag_y += float(self._rng.normal(0, noise_std))
        mag_z += float(self._rng.normal(0, noise_std))

        # Sensor drift
        if scenario == Scenario.SENSOR_DRIFT:
            drift = t * 0.01  # Slow drift over time
            mag_x += drift
            mag_y += drift * 0.5
            mag_z += drift * 0.3

        # Anomalies
        if scenario == Scenario.WEAK_ANOMALY:
            mag_x, mag_y, mag_z = self._add_anomaly(
                mag_x, mag_y, mag_z, t,
                center=self.config.duration_seconds * 0.5,
                width=10.0, strength=5.0,
            )
        elif scenario == Scenario.STRONG_ANOMALY:
            mag_x, mag_y, mag_z = self._add_anomaly(
                mag_x, mag_y, mag_z, t,
                center=self.config.duration_seconds * 0.5,
                width=15.0, strength=30.0,
            )
        elif scenario == Scenario.MULTIPLE_TARGETS:
            for center_frac in [0.25, 0.5, 0.75]:
                center = self.config.duration_seconds * center_frac
                strength = float(self._rng.uniform(8, 25))
                mag_x, mag_y, mag_z = self._add_anomaly(
                    mag_x, mag_y, mag_z, t,
                    center=center, width=8.0, strength=strength,
                )

        # Sensor failure
        if scenario == Scenario.SENSOR_FAILURE and t > self.config.duration_seconds * 0.7:
            mag_x = mag_y = mag_z = None  # Simulate disconnected sensor

        # GPS trajectory (slow survey movement)
        lat = self.config.base_latitude + t * 0.00001 * math.cos(t * 0.01)
        lon = self.config.base_longitude + t * 0.00001 * math.sin(t * 0.01)

        # Depth variation
        depth = self.config.base_depth + 2.0 * math.sin(t * 0.05) + float(self._rng.normal(0, 0.3))

        # Turbidity
        turbidity = self.config.turbidity_base + float(
            self._rng.normal(0, self.config.turbidity_noise)
        )
        turbidity = max(0.0, turbidity)

        # Pressure from depth (approximate)
        pressure = 1013.25 + depth * 100.5

        # Battery discharge
        battery = self.config.battery_start_voltage - (t / self.config.duration_seconds) * 1.5

        timestamp = datetime.fromtimestamp(time.time() + t, tz=timezone.utc)

        return SensorPacket(
            device_id=self.config.device_id,
            timestamp=timestamp,
            sequence=self._sequence,
            mag_x=mag_x,
            mag_y=mag_y,
            mag_z=mag_z,
            turbidity=round(turbidity, 1),
            pressure=round(pressure, 1),
            latitude=round(lat, 6),
            longitude=round(lon, 6),
            depth=round(depth, 2),
            battery_voltage=round(battery, 2),
        )

    def _add_anomaly(
        self,
        x: float, y: float, z: float,
        t: float,
        center: float,
        width: float,
        strength: float,
    ) -> tuple[float, float, float]:
        """Add a Gaussian-shaped magnetic anomaly."""
        distance = abs(t - center)
        if distance > width * 3:
            return x, y, z

        envelope = strength * math.exp(-0.5 * (distance / (width / 2.5)) ** 2)
        # Anomaly primarily affects Z axis (vertical) and magnitude
        x += envelope * 0.3
        y += envelope * 0.2
        z += envelope * 1.0

        return x, y, z
