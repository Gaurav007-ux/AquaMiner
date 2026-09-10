"""
AquaYantra — Data quality engine.

Computes a quality score (0–1) for each sensor reading based on
missing values, range violations, packet loss, calibration state, etc.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.core.config import settings
from app.schemas.sensor_packet import SensorPacket


@dataclass
class QualityResult:
    """Result of a data-quality assessment."""
    score: float  # 0.0 – 1.0
    issues: list[str] = field(default_factory=list)
    status: str = "GOOD"  # GOOD, ACCEPTABLE, DEGRADED, POOR

    def add_issue(self, issue: str, penalty: float) -> None:
        self.issues.append(issue)
        self.score = max(0.0, self.score - penalty)

    def finalize(self) -> None:
        if self.score >= 0.85:
            self.status = "GOOD"
        elif self.score >= 0.65:
            self.status = "ACCEPTABLE"
        elif self.score >= 0.40:
            self.status = "DEGRADED"
        else:
            self.status = "POOR"


class DataQualityEngine:
    """
    Stateless data-quality scorer.

    Each call to `evaluate` produces an independent quality assessment.
    """

    def __init__(self) -> None:
        self._last_sequence: dict[str, int] = {}
        self._last_timestamp: dict[str, float] = {}

    def evaluate(
        self,
        packet: SensorPacket,
        calibration_status: str = "uncalibrated",
    ) -> QualityResult:
        """Evaluate quality of a sensor packet."""
        result = QualityResult(score=1.0)

        # ── Missing magnetometer data ────────────────────────────
        if packet.mag_x is None or packet.mag_y is None or packet.mag_z is None:
            result.add_issue("Missing magnetometer data", 0.40)

        # ── GPS validity ─────────────────────────────────────────
        if packet.latitude is None or packet.longitude is None:
            result.add_issue("Missing GPS position", 0.10)

        # ── Battery state ────────────────────────────────────────
        if packet.battery_voltage is not None:
            if packet.battery_voltage < 7.0:
                result.add_issue("Critical battery voltage", 0.15)
            elif packet.battery_voltage < 9.0:
                result.add_issue("Low battery voltage", 0.05)

        # ── Turbidity sensor ─────────────────────────────────────
        if packet.turbidity is None:
            result.add_issue("Missing turbidity data", 0.03)

        # ── Packet sequence gaps ─────────────────────────────────
        if packet.sequence is not None:
            last = self._last_sequence.get(packet.device_id)
            if last is not None:
                gap = packet.sequence - last
                if gap > 1:
                    penalty = min(0.15, gap * 0.02)
                    result.add_issue(f"Packet sequence gap of {gap - 1}", penalty)
                elif gap <= 0:
                    result.add_issue("Duplicate or out-of-order packet", 0.10)
            self._last_sequence[packet.device_id] = packet.sequence

        # ── Timestamp consistency ────────────────────────────────
        ts = packet.timestamp.timestamp()
        last_ts = self._last_timestamp.get(packet.device_id)
        if last_ts is not None:
            dt = ts - last_ts
            if dt < 0:
                result.add_issue("Timestamp went backwards", 0.20)
            elif dt > 30:
                result.add_issue(f"Large timestamp gap ({dt:.0f}s)", 0.05)
        self._last_timestamp[packet.device_id] = ts

        # ── Calibration state ────────────────────────────────────
        if calibration_status == "uncalibrated":
            result.add_issue("Sensor not yet calibrated", 0.10)
        elif calibration_status in ("sensor_fault", "low_confidence"):
            result.add_issue(f"Calibration status: {calibration_status}", 0.15)

        # ── Depth sensor ─────────────────────────────────────────
        if packet.depth is not None and packet.depth < 0:
            result.add_issue("Invalid negative depth", 0.08)

        result.finalize()
        return result
