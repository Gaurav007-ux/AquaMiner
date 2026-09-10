// =============================================================================
// AQUAYANTRA — health.cpp
// System and sensor health monitoring implementation
// =============================================================================
#include "health.h"

const char* healthStateStr(HealthState s) {
    switch (s) {
        case HEALTH_HEALTHY:  return "HEALTHY";
        case HEALTH_WARNING:  return "WARNING";
        case HEALTH_DEGRADED: return "DEGRADED";
        case HEALTH_FAULT:    return "FAULT";
        case HEALTH_OFFLINE:  return "OFFLINE";
        default:              return "UNKNOWN";
    }
}

float calculateDataQuality(const SystemHealth &h) {
    float score = 0.0f;

    // 1. Magnetometer (30% weight — primary payload)
    switch (h.magnetometer) {
        case HEALTH_HEALTHY:  score += 0.30f; break;
        case HEALTH_WARNING:  score += 0.18f; break;
        case HEALTH_DEGRADED: score += 0.08f; break;
        default: break;
    }

    // 2. BMP280 Pressure/Depth (10% weight)
    switch (h.bmp280) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.06f; break;
        case HEALTH_DEGRADED: score += 0.03f; break;
        default: break;
    }

    // 3. DS18B20 Water Temperature (10% weight)
    switch (h.waterTemp) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.06f; break;
        default: break;
    }

    // 4. pH Sensor (10% weight)
    switch (h.ph) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.05f; break;
        default: break;
    }

    // 4. TDS Sensor (10% weight)
    switch (h.tds) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.05f; break;
        default: break;
    }

    // 5. Turbidity Sensor (10% weight)
    switch (h.turbidity) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.05f; break;
        default: break;
    }

    // 6. Battery (10% weight)
    switch (h.battery) {
        case HEALTH_HEALTHY:  score += 0.10f; break;
        case HEALTH_WARNING:  score += 0.07f; break;
        case HEALTH_DEGRADED: score += 0.03f; break;
        default: break;
    }

    // 7. MicroSD Storage (5% weight)
    switch (h.sdCard) {
        case HEALTH_HEALTHY:  score += 0.05f; break;
        case HEALTH_WARNING:  score += 0.02f; break;
        default: break;
    }

    // 8. Calibration Status Bonus (5% weight)
    if (h.calibLoaded) {
        score += 0.05f;
    }

    if (score > 1.0f) score = 1.0f;
    if (score < 0.0f) score = 0.0f;
    return score;
}
