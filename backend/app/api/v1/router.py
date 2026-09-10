"""AquaYantra — V1 API router aggregating all endpoint modules."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, devices, readings, missions, deployments, calibration, ml, map_api, analytics, system

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(devices.router, prefix="/devices", tags=["Devices"])
router.include_router(readings.router, prefix="/readings", tags=["Readings"])
router.include_router(missions.router, prefix="/missions", tags=["Missions"])
router.include_router(deployments.router, prefix="/deployments", tags=["Deployments"])
router.include_router(calibration.router, prefix="/calibration", tags=["Calibration"])
router.include_router(ml.router, prefix="/ml", tags=["ML"])
router.include_router(map_api.router, prefix="/map", tags=["Map"])
router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
router.include_router(system.router, prefix="/system", tags=["System"])
