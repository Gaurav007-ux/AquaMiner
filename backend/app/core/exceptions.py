"""
AquaYantra — Custom exception hierarchy.

All domain exceptions derive from AquaYantraError so they can be caught
uniformly by the FastAPI exception handlers.
"""

from __future__ import annotations

from typing import Any


class AquaYantraError(Exception):
    """Base exception for all AquaYantra domain errors."""

    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


AquaMinerError = AquaYantraError  # Backwards-compatibility alias


# ── Validation ───────────────────────────────────────────────────

class ValidationError(AquaYantraError):
    """Raised when input data fails validation."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("VALIDATION_ERROR", message, details)


class InvalidSensorPacketError(AquaYantraError):
    """Raised when a sensor packet is malformed or out of range."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("INVALID_SENSOR_PACKET", message, details)


class DuplicatePacketError(AquaYantraError):
    """Raised when a duplicate sensor packet is detected."""

    def __init__(self, device_id: str, sequence: int) -> None:
        super().__init__(
            "DUPLICATE_PACKET",
            f"Duplicate packet: device={device_id}, seq={sequence}",
            {"device_id": device_id, "sequence": sequence},
        )


# ── Not found ────────────────────────────────────────────────────

class NotFoundError(AquaYantraError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str, identifier: Any) -> None:
        super().__init__(
            "NOT_FOUND",
            f"{resource} with id '{identifier}' not found",
            {"resource": resource, "id": str(identifier)},
        )


# ── Auth ─────────────────────────────────────────────────────────

class AuthenticationError(AquaYantraError):
    """Raised on authentication failures."""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__("AUTH_ERROR", message)


class AuthorizationError(AquaYantraError):
    """Raised when a user lacks permission."""

    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__("AUTHORIZATION_ERROR", message)


# ── Sensor / calibration ────────────────────────────────────────

class SensorError(AquaYantraError):
    """Raised for sensor-related failures."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("SENSOR_ERROR", message, details)


class CalibrationError(AquaYantraError):
    """Raised for calibration failures."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("CALIBRATION_ERROR", message, details)


# ── ML ───────────────────────────────────────────────────────────

class MLError(AquaYantraError):
    """Raised for ML pipeline failures."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("ML_ERROR", message, details)


class ModelNotFoundError(AquaYantraError):
    """Raised when no active ML model is available."""

    def __init__(self, model_type: str = "anomaly") -> None:
        super().__init__(
            "MODEL_NOT_FOUND",
            f"No active {model_type} model is available",
        )


# ── Database ─────────────────────────────────────────────────────

class DatabaseError(AquaYantraError):
    """Raised for unexpected database errors."""

    def __init__(self, message: str = "A database error occurred") -> None:
        super().__init__("DATABASE_ERROR", message)


# ── Conflict ─────────────────────────────────────────────────────

class ConflictError(AquaYantraError):
    """Raised when an operation conflicts with existing state."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("CONFLICT", message, details)
