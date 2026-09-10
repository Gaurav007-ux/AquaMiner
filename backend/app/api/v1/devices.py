"""AquaYantra — Device API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_operator, require_viewer
from app.core.exceptions import NotFoundError
from app.models.device import Device
from app.repositories.repositories import DeviceRepository, SensorRepository
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate, SensorResponse

router = APIRouter()


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = DeviceRepository(db)
    return await repo.get_all(offset=offset, limit=limit)


@router.post("", response_model=DeviceResponse, status_code=201)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = DeviceRepository(db)
    device = Device(**body.model_dump())
    return await repo.create(device)


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = DeviceRepository(db)
    device = await repo.get_by_id(device_id)
    if not device:
        raise NotFoundError("Device", device_id)
    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: uuid.UUID,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = DeviceRepository(db)
    device = await repo.get_by_id(device_id)
    if not device:
        raise NotFoundError("Device", device_id)
    return await repo.update(device, body.model_dump(exclude_unset=True))


@router.get("/{device_id}/sensors", response_model=list[SensorResponse])
async def get_device_sensors(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = SensorRepository(db)
    return await repo.get_by_device(device_id)
