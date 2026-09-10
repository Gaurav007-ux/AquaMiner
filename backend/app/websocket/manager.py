"""
AquaYantra — WebSocket connection manager and routes.

Manages per-device and per-deployment channels with heartbeat,
backpressure protection, and graceful disconnect.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("websocket")

router = APIRouter()


class ConnectionManager:
    """
    Manages WebSocket connections organized by channel.

    Channels: device:<id>, deployment:<id>, broadcast
    """

    def __init__(self, max_connections: int | None = None) -> None:
        self._max = max_connections or settings.WS_MAX_CONNECTIONS
        self._channels: dict[str, set[WebSocket]] = {}
        self._connection_count: int = 0

    @property
    def connection_count(self) -> int:
        return self._connection_count

    async def connect(self, websocket: WebSocket, channel: str) -> bool:
        """Accept a WebSocket connection and add it to a channel."""
        if self._connection_count >= self._max:
            logger.warning("ws_max_connections_reached", max=self._max)
            await websocket.close(code=1013, reason="Max connections reached")
            return False

        await websocket.accept()
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)
        self._connection_count += 1

        logger.info("ws_connected", channel=channel, total=self._connection_count)
        return True

    async def disconnect(self, websocket: WebSocket, channel: str) -> None:
        """Remove a WebSocket from a channel."""
        if channel in self._channels:
            self._channels[channel].discard(websocket)
            if not self._channels[channel]:
                del self._channels[channel]
        self._connection_count = max(0, self._connection_count - 1)
        logger.info("ws_disconnected", channel=channel, total=self._connection_count)

    async def broadcast_to_channel(self, channel: str, data: dict[str, Any]) -> None:
        """Send a message to all connections in a channel."""
        connections = self._channels.get(channel, set()).copy()
        message = json.dumps(data, default=str)

        dead: list[WebSocket] = []
        for ws in connections:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await asyncio.wait_for(ws.send_text(message), timeout=5.0)
            except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError):
                dead.append(ws)
            except Exception as e:
                logger.warning("ws_send_error", error=str(e))
                dead.append(ws)

        # Clean up dead connections
        for ws in dead:
            await self.disconnect(ws, channel)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Broadcast to all channels."""
        for channel in list(self._channels.keys()):
            await self.broadcast_to_channel(channel, data)

    async def send_to_device(self, device_id: str, data: dict[str, Any]) -> None:
        """Send data to all connections watching a specific device."""
        await self.broadcast_to_channel(f"device:{device_id}", data)

    async def send_to_deployment(self, deployment_id: str, data: dict[str, Any]) -> None:
        """Send data to all connections watching a specific deployment."""
        await self.broadcast_to_channel(f"deployment:{deployment_id}", data)


# Singleton manager
ws_manager = ConnectionManager()


# ── WebSocket routes ─────────────────────────────────────────────

@router.websocket("/ws/devices/{device_id}")
async def ws_device(websocket: WebSocket, device_id: str) -> None:
    """WebSocket endpoint for monitoring a specific device."""
    channel = f"device:{device_id}"
    if not await ws_manager.connect(websocket, channel):
        return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=settings.WS_HEARTBEAT_INTERVAL + 10,
                )
                # Handle client messages (e.g., heartbeat pong)
                if msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_text(json.dumps({"type": "heartbeat", "ts": time.time()}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("ws_device_error", device_id=device_id, error=str(e))
    finally:
        await ws_manager.disconnect(websocket, channel)


@router.websocket("/ws/deployments/{deployment_id}")
async def ws_deployment(websocket: WebSocket, deployment_id: str) -> None:
    """WebSocket endpoint for monitoring a specific deployment."""
    channel = f"deployment:{deployment_id}"
    if not await ws_manager.connect(websocket, channel):
        return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=settings.WS_HEARTBEAT_INTERVAL + 10,
                )
                if msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(json.dumps({"type": "heartbeat", "ts": time.time()}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("ws_deployment_error", deployment_id=deployment_id, error=str(e))
    finally:
        await ws_manager.disconnect(websocket, channel)
