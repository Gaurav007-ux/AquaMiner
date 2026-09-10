"""AquaYantra — Mission API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_operator, require_viewer
from app.core.exceptions import NotFoundError
from app.models.mission import Mission
from app.repositories.repositories import MissionRepository
from app.schemas.mission import MissionCreate, MissionResponse, MissionUpdate

router = APIRouter()


@router.get("", response_model=list[MissionResponse])
async def list_missions(
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = MissionRepository(db)
    return await repo.get_all(offset=offset, limit=limit)


@router.post("", response_model=MissionResponse, status_code=201)
async def create_mission(
    body: MissionCreate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = MissionRepository(db)
    mission = Mission(**body.model_dump(), start_time=datetime.now(timezone.utc))
    return await repo.create(mission)


@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_viewer),
):
    repo = MissionRepository(db)
    mission = await repo.get_by_id(mission_id)
    if not mission:
        raise NotFoundError("Mission", mission_id)
    return mission


@router.patch("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: uuid.UUID,
    body: MissionUpdate,
    db: AsyncSession = Depends(get_session),
    _: dict = Depends(require_operator),
):
    repo = MissionRepository(db)
    mission = await repo.get_by_id(mission_id)
    if not mission:
        raise NotFoundError("Mission", mission_id)
    return await repo.update(mission, body.model_dump(exclude_unset=True))
