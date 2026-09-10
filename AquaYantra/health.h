// =============================================================================
// AQUAYANTRA — health.h
// System and sensor health monitoring with weighted data quality assessment.
// Weights: Mag 35%, BMP280 15%, pH 10%, TDS 10%, Turbidity 10%, Battery 10%,
// SD 5%, Calibration 5% = 100% Total.
// =============================================================================
#pragma once
#include <Arduino.h>

enum HealthState {
    HEALTH_HEALTHY  = 0,
    HEALTH_WARNING  = 1,
    HEALTH_DEGRADED = 2,
    HEALTH_FAULT    = 3,
    HEALTH_OFFLINE  = 4
};

struct SystemHealth {
    HealthState magnetometer = HEALTH_OFFLINE;
    HealthState bmp280       = HEALTH_OFFLINE;
    HealthState waterTemp    = HEALTH_OFFLINE;
    HealthState ph           = HEALTH_HEALTHY;
    HealthState tds          = HEALTH_HEALTHY;
    HealthState turbidity    = HEALTH_HEALTHY;
    HealthState battery      = HEALTH_HEALTHY;
    HealthState sdCard       = HEALTH_OFFLINE;
    bool        calibLoaded  = false;
};

const char* healthStateStr(HealthState s);
float       calculateDataQuality(const SystemHealth &h);
