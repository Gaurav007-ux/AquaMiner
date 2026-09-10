"""AquaYantra — Deployment API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_operator, require_viewer
from app.core.exceptions import NotFoundError
from app.models.mission import Deployment
from app.repositories.repositories import (
    DeploymentRepository,
    DetectionEventRepository,
    ReadingRepository,
)
from app.schemas.detection import DetectionEventResponse
from app.schemas.mission import DeploymentCreate, DeploymentResponse, DeploymentUpdate
from app.schemas.reading import ReadingCompactResponse

router = APIRouter()


@router.post("", response_model=DeploymentResponse, status_code=201)
async def create_deployment(
    body: DeploymentCreate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = DeploymentRepository(db)
    deployment = Deployment(
        mission_id=body.mission_id,
        device_id=body.device_id,
        deployment_number=body.deployment_number,
        start_time=datetime.now(timezone.utc),
        status="active",
    )
    if body.start_latitude and body.start_longitude:
        deployment.start_location = f"SRID=4326;POINT({body.start_longitude} {body.start_latitude})"
    return await repo.create(deployment)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = DeploymentRepository(db)
    dep = await repo.get_by_id(deployment_id)
    if not dep:
        raise NotFoundError("Deployment", deployment_id)
    return dep


@router.patch("/{deployment_id}", response_model=DeploymentResponse)
async def update_deployment(
    deployment_id: uuid.UUID,
    body: DeploymentUpdate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = DeploymentRepository(db)
    dep = await repo.get_by_id(deployment_id)
    if not dep:
        raise NotFoundError("Deployment", deployment_id)
    data = body.model_dump(exclude_unset=True)
    if "end_latitude" in data and "end_longitude" in data:
        dep.end_location = f"SRID=4326;POINT({data.pop('end_longitude')} {data.pop('end_latitude')})"
    return await repo.update(dep, data)


@router.get("/{deployment_id}/readings", response_model=list[ReadingCompactResponse])
async def deployment_readings(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    repo = ReadingRepository(db)
    return await repo.get_by_deployment(deployment_id, offset=offset, limit=limit)


@router.get("/{deployment_id}/anomalies", response_model=list[DetectionEventResponse])
async def deployment_anomalies(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = DetectionEventRepository(db)
    return await repo.get_by_deployment(deployment_id)
