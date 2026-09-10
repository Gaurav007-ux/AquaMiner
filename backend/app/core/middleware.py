"""
AquaYantra — Middleware.

Request-ID injection, request timing, CORS, and simple rate limiting.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import settings
from app.core.logging import generate_request_id, get_logger, request_id_ctx

logger = get_logger("middleware")


# ── Request ID + Timing middleware ───────────────────────────────

class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign a unique request ID and measure wall-clock latency."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rid = request.headers.get("X-Request-ID") or generate_request_id()
        request_id_ctx.set(rid)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        response.headers["X-Request-ID"] = rid
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"

        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            elapsed_ms=round(elapsed_ms, 1),
        )
        return response


# ── Simple in-memory rate limiter ────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple sliding-window rate limiter keyed by client IP.

    For production at scale, replace with Redis-backed limiter.
    """

    def __init__(self, app: FastAPI, max_requests: int = 120, window_seconds: int = 60) -> None:  # type: ignore[override]
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        cutoff = now - self.window

        # Prune old entries
        hits = self._hits[client_ip]
        self._hits[client_ip] = [t for t in hits if t > cutoff]

        if len(self._hits[client_ip]) >= self.max_requests:
            logger.warning("rate_limit_exceeded", client_ip=client_ip)
            return Response(
                content='{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
            )

        self._hits[client_ip].append(now)
        return await call_next(request)


# ── Register all middleware ──────────────────────────────────────

def register_middleware(app: FastAPI) -> None:
    """Attach all middleware to the FastAPI application."""
    # Order matters — outermost first
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.RATE_LIMIT_PER_MINUTE,
        window_seconds=60,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
