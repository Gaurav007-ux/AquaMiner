// =============================================================================
// AQUAYANTRA — processing.h
// Signal processing, baseline tracking, and 3-state anomaly detection engine.
// States: NORMAL, ANOMALY_CANDIDATE, DETECTED_EVENT.
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

enum AnomalyState {
    STATE_NORMAL            = 0,
    STATE_ANOMALY_CANDIDATE = 1,
    STATE_DETECTED_EVENT    = 2
};

struct BaselineTracker {
    float    value           = 0.0f;
    float    deviation       = 0.0f;
    float    lastDeviation   = 0.0f;
    float    rateOfChange    = 0.0f; // µT/s
    float    noiseFloor      = 0.0f;
    bool     frozen          = false;
    bool     initialized     = false;
    uint32_t lastUpdateMs    = 0;
};

struct AnomalyEngine {
    AnomalyState state            = STATE_NORMAL;
    uint16_t     candidateCount   = 0;
    float        peakDeviation    = 0.0f;
    float        anomalyScore     = 0.0f;
    uint32_t     eventStartTime   = 0;
    uint32_t     cooldownStartTime= 0;
    bool         inCooldown       = false;
    uint32_t     eventCounter     = 0;
};

void processingInit(BaselineTracker &tracker, AnomalyEngine &engine);
void processingResetBaseline(BaselineTracker &tracker, AnomalyEngine &engine);
void processingUpdate(BaselineTracker &tracker, AnomalyEngine &engine, 
                      float currentMagnitude, uint32_t timestampMs);
const char* processingStateStr(AnomalyState state);
