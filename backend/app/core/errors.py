"""
AquaYantra — Error response models and FastAPI exception handlers.

Translates domain exceptions into standardized JSON error responses.
No raw Python tracebacks in production.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.exceptions import (
    AquaMinerError,
    AquaYantraError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.core.logging import get_logger, request_id_ctx

logger = get_logger("errors")


class ErrorDetail(BaseModel):
    """Standardized error response body."""
    code: str
    message: str
    request_id: str = ""
    details: dict[str, Any] = {}


class ErrorResponse(BaseModel):
    """Envelope for error responses."""
    error: ErrorDetail


def _build_response(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    rid = request_id_ctx.get("")
    body = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            request_id=rid,
            details=details or {},
        )
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


# ── Status-code mapping ─────────────────────────────────────────

_STATUS_MAP: dict[type, int] = {
    ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    NotFoundError: status.HTTP_404_NOT_FOUND,
    AuthenticationError: status.HTTP_401_UNAUTHORIZED,
    AuthorizationError: status.HTTP_403_FORBIDDEN,
    ConflictError: status.HTTP_409_CONFLICT,
}


async def aquayantra_error_handler(request: Request, exc: AquaYantraError) -> JSONResponse:  # noqa: ARG001
    """Handle all AquaYantraError subclasses."""
    status_code = _STATUS_MAP.get(type(exc), status.HTTP_400_BAD_REQUEST)
    logger.warning("domain_error", code=exc.code, message=exc.message, details=exc.details)
    return _build_response(status_code, exc.code, exc.message, exc.details)


# Backwards-compatibility alias
aquaminer_error_handler = aquayantra_error_handler


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:  # noqa: ARG001
    """Handle Pydantic / FastAPI request-validation errors."""
    errors = exc.errors()
    logger.warning("request_validation_error", errors=errors)
    return _build_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDATION_ERROR",
        "Request validation failed",
        {"errors": errors},
    )


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
    """Catch-all for unhandled exceptions — no tracebacks leak to clients."""
    logger.exception("unhandled_exception", exc_info=exc)
    return _build_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "An unexpected error occurred",
    )


def register_error_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the FastAPI app."""
    app.add_exception_handler(AquaYantraError, aquayantra_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(AquaMinerError, aquayantra_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_error_handler)
