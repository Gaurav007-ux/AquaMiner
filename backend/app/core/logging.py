"""
AquaYantra — Structured logging.

JSON-formatted structured logs with request-ID, device-ID, deployment-ID injection.
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

import structlog

from app.core.config import settings

# Context variables for request-scoped metadata
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
device_id_ctx: ContextVar[str] = ContextVar("device_id", default="")
deployment_id_ctx: ContextVar[str] = ContextVar("deployment_id", default="")


def generate_request_id() -> str:
    """Generate a short unique request ID."""
    return uuid.uuid4().hex[:12]


def _add_context(
    logger: Any,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """Inject context variables into every log entry."""
    rid = request_id_ctx.get("")
    if rid:
        event_dict["request_id"] = rid
    did = device_id_ctx.get("")
    if did:
        event_dict["device_id"] = did
    dep = deployment_id_ctx.get("")
    if dep:
        event_dict["deployment_id"] = dep
    return event_dict


def setup_logging() -> None:
    """Configure structlog + stdlib logging for the application."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Stdlib logging — capture third-party library logs
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        _add_context,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.ENVIRONMENT == "development":
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    root = logging.getLogger()
    for handler in root.handlers:
        handler.setFormatter(formatter)
    root.setLevel(log_level)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog logger, optionally bound to a component name."""
    logger: structlog.stdlib.BoundLogger = structlog.get_logger(name or "aquayantra")
    return logger
