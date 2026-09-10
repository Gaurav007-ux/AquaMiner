"""AquaYantra — Concrete repository implementations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Sequence

from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calibration import CalibrationProfile
from app.models.detection import DetectionEvent
from app.models.device import Device, Sensor
from app.models.mission import Deployment, Mission
from app.models.ml_model import MLModel, Prediction
from app.models.reading import SensorReading
from app.models.survey import SurveyPoint
from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class DeviceRepository(BaseRepository[Device]):
    model = Device

    async def get_by_serial(self, serial: str) -> Device | None:
        stmt = select(Device).where(Device.device_serial == serial)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active(self) -> Sequence[Device]:
        stmt = select(Device).where(Device.status == "active")
        result = await self.session.execute(stmt)
        return result.scalars().all()


class SensorRepository(BaseRepository[Sensor]):
    model = Sensor

    async def get_by_device(self, device_id: uuid.UUID) -> Sequence[Sensor]:
        stmt = select(Sensor).where(Sensor.device_id == device_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()


class MissionRepository(BaseRepository[Mission]):
    model = Mission

    async def get_active(self) -> Sequence[Mission]:
        stmt = select(Mission).where(Mission.status.in_(["planned", "active"]))
        result = await self.session.execute(stmt)
        return result.scalars().all()


class DeploymentRepository(BaseRepository[Deployment]):
    model = Deployment

    async def get_by_mission(self, mission_id: uuid.UUID) -> Sequence[Deployment]:
        stmt = select(Deployment).where(Deployment.mission_id == mission_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_active_for_device(self, device_id: uuid.UUID) -> Deployment | None:
        stmt = (
            select(Deployment)
            .where(and_(Deployment.device_id == device_id, Deployment.status == "active"))
            .order_by(desc(Deployment.start_time))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class ReadingRepository(BaseRepository[SensorReading]):
    model = SensorReading

    async def get_by_deployment(
        self,
        deployment_id: uuid.UUID,
        offset: int = 0,
        limit: int = 100,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> Sequence[SensorReading]:
        stmt = select(SensorReading).where(SensorReading.deployment_id == deployment_id)
        if start:
            stmt = stmt.where(SensorReading.timestamp >= start)
        if end:
            stmt = stmt.where(SensorReading.timestamp <= end)
        stmt = stmt.order_by(SensorReading.timestamp.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_device(
        self,
        device_id: uuid.UUID,
        limit: int = 100,
    ) -> Sequence[SensorReading]:
        stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_deployment(self, deployment_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(SensorReading).where(
            SensorReading.deployment_id == deployment_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_latest(self, device_id: uuid.UUID) -> SensorReading | None:
        stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def bulk_insert(self, readings: list[SensorReading]) -> None:
        """Optimized bulk insert for high-frequency sensor data."""
        self.session.add_all(readings)
        await self.session.flush()

    async def check_duplicate(self, device_id: uuid.UUID, sequence: int) -> bool:
        stmt = select(func.count()).select_from(SensorReading).where(
            and_(SensorReading.device_id == device_id, SensorReading.sequence == sequence)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() > 0


class SurveyPointRepository(BaseRepository[SurveyPoint]):
    model = SurveyPoint

    async def get_by_deployment(self, deployment_id: uuid.UUID) -> Sequence[SurveyPoint]:
        stmt = (
            select(SurveyPoint)
            .where(SurveyPoint.deployment_id == deployment_id)
            .order_by(SurveyPoint.timestamp)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_anomalies(
        self,
        min_score: float = 0.5,
        limit: int = 200,
    ) -> Sequence[SurveyPoint]:
        stmt = (
            select(SurveyPoint)
            .where(SurveyPoint.anomaly_score >= min_score)
            .order_by(SurveyPoint.anomaly_score.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_nearby(
        self,
        lat: float,
        lon: float,
        radius_meters: float = 100.0,
    ) -> Sequence[SurveyPoint]:
        point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
        stmt = (
            select(SurveyPoint)
            .where(ST_DWithin(SurveyPoint.geometry, point, radius_meters))
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


class DetectionEventRepository(BaseRepository[DetectionEvent]):
    model = DetectionEvent

    async def get_by_deployment(self, deployment_id: uuid.UUID) -> Sequence[DetectionEvent]:
        stmt = (
            select(DetectionEvent)
            .where(DetectionEvent.deployment_id == deployment_id)
            .order_by(DetectionEvent.timestamp.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_all_with_locations(self, limit: int = 500) -> Sequence[DetectionEvent]:
        stmt = (
            select(DetectionEvent)
            .where(DetectionEvent.latitude.isnot(None))
            .order_by(DetectionEvent.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


class CalibrationRepository(BaseRepository[CalibrationProfile]):
    model = CalibrationProfile

    async def get_active_for_device(self, device_id: uuid.UUID) -> CalibrationProfile | None:
        stmt = (
            select(CalibrationProfile)
            .where(
                and_(
                    CalibrationProfile.device_id == device_id,
                    CalibrationProfile.active == True,  # noqa: E712
                )
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def deactivate_all(self, device_id: uuid.UUID) -> None:
        stmt = (
            select(CalibrationProfile)
            .where(
                and_(
                    CalibrationProfile.device_id == device_id,
                    CalibrationProfile.active == True,  # noqa: E712
                )
            )
        )
        result = await self.session.execute(stmt)
        for profile in result.scalars().all():
            profile.active = False
        await self.session.flush()

    async def get_history(self, device_id: uuid.UUID) -> Sequence[CalibrationProfile]:
        stmt = (
            select(CalibrationProfile)
            .where(CalibrationProfile.device_id == device_id)
            .order_by(CalibrationProfile.version.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


class MLModelRepository(BaseRepository[MLModel]):
    model = MLModel

    async def get_active(self, model_type: str | None = None) -> MLModel | None:
        stmt = select(MLModel).where(MLModel.status == "active")
        if model_type:
            stmt = stmt.where(MLModel.model_type == model_type)
        stmt = stmt.order_by(MLModel.version.desc()).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_version(self, model_type: str) -> int:
        stmt = (
            select(func.coalesce(func.max(MLModel.version), 0))
            .where(MLModel.model_type == model_type)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()


class PredictionRepository(BaseRepository[Prediction]):
    model = Prediction

    async def get_by_deployment(self, deployment_id: uuid.UUID, limit: int = 100) -> Sequence[Prediction]:
        stmt = (
            select(Prediction)
            .where(Prediction.deployment_id == deployment_id)
            .order_by(Prediction.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
