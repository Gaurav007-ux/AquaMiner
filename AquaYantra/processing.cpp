// =============================================================================
// AQUAYANTRA — processing.cpp
// Signal processing and 3-state anomaly detection engine implementation
// =============================================================================
#include "processing.h"
#include <math.h>

void processingInit(BaselineTracker &tracker, AnomalyEngine &engine) {
    tracker.value         = 0.0f;
    tracker.deviation     = 0.0f;
    tracker.lastDeviation = 0.0f;
    tracker.rateOfChange  = 0.0f;
    tracker.noiseFloor    = 0.0f;
    tracker.frozen        = false;
    tracker.initialized   = false;
    tracker.lastUpdateMs  = 0;

    engine.state             = STATE_NORMAL;
    engine.candidateCount    = 0;
    engine.peakDeviation     = 0.0f;
    engine.anomalyScore      = 0.0f;
    engine.eventStartTime    = 0;
    engine.cooldownStartTime = 0;
    engine.inCooldown        = false;
    engine.eventCounter      = 0;
}

void processingResetBaseline(BaselineTracker &tracker, AnomalyEngine &engine) {
    tracker.initialized   = false;
    tracker.frozen        = false;
    tracker.lastDeviation = 0.0f;
    tracker.rateOfChange  = 0.0f;
    
    engine.state          = STATE_NORMAL;
    engine.candidateCount = 0;
    engine.peakDeviation  = 0.0f;
    engine.inCooldown     = false;
    
#if DEBUG_MODE
    Serial.println(F("[PROC] Baseline and anomaly state reset requested."));
#endif
}

void processingUpdate(BaselineTracker &tracker, AnomalyEngine &engine, 
                      float currentMagnitude, uint32_t timestampMs) {
    if (!tracker.initialized) {
        tracker.value         = currentMagnitude;
        tracker.deviation     = 0.0f;
        tracker.lastDeviation = 0.0f;
        tracker.rateOfChange  = 0.0f;
        tracker.noiseFloor    = 0.05f;
        tracker.frozen        = false;
        tracker.initialized   = true;
        tracker.lastUpdateMs  = timestampMs;
        return;
    }

    float dt = (float)(timestampMs - tracker.lastUpdateMs) / 1000.0f;
    if (dt < 0.005f) dt = 0.005f; // Prevent divide by zero or extreme derivatives
    tracker.lastUpdateMs = timestampMs;

    // Deviation from current baseline
    float dev = currentMagnitude - tracker.value;
    tracker.deviation = dev;

    // Rate of change (derivative) in µT/s with light smoothing
    float instantRoc = (dev - tracker.lastDeviation) / dt;
    tracker.rateOfChange = (tracker.rateOfChange * 0.70f) + (instantRoc * 0.30f);
    tracker.lastDeviation = dev;

    // Noise floor update (smoothed variance)
    tracker.noiseFloor = (tracker.noiseFloor * 0.98f) + (fabsf(dev) * 0.02f);

    // Baseline adaptation with FREEZE protection during candidate/active anomaly
    if (fabsf(dev) > BASELINE_FREEZE_UT || engine.state != STATE_NORMAL) {
        tracker.frozen = true;
        // Do NOT adapt baseline while anomaly is present!
    } else {
        tracker.frozen = false;
        // Exponential Moving Average adaptation
        tracker.value = (tracker.value * (1.0f - BASELINE_ADAPTATION_RATE)) + 
                        (currentMagnitude * BASELINE_ADAPTATION_RATE);
    }

    // Normalized anomaly score (0.0 to 1.0)
    float devScore = fabsf(dev) / (ANOMALY_THRESHOLD_UT * 2.5f);
    float rocScore = fabsf(tracker.rateOfChange) / (ROC_THRESHOLD_UT_S * 2.0f);
    float composite = (devScore * WEIGHT_MAG_DEV) + (rocScore * WEIGHT_MAG_ROC);
    if (composite > 1.0f) composite = 1.0f;
    if (composite < 0.0f) composite = 0.0f;
    engine.anomalyScore = composite;

    // -------------------------------------------------------------------------
    // 3-STATE ANOMALY STATE MACHINE
    // -------------------------------------------------------------------------
    bool exceedsThreshold = (fabsf(dev) >= ANOMALY_THRESHOLD_UT) || 
                            (fabsf(tracker.rateOfChange) >= ROC_THRESHOLD_UT_S);

    switch (engine.state) {
        case STATE_NORMAL:
            if (exceedsThreshold) {
                engine.state          = STATE_ANOMALY_CANDIDATE;
                engine.candidateCount = 1;
                engine.peakDeviation  = fabsf(dev);
            }
            break;

        case STATE_ANOMALY_CANDIDATE:
            if (exceedsThreshold) {
                engine.candidateCount++;
                if (fabsf(dev) > engine.peakDeviation) {
                    engine.peakDeviation = fabsf(dev);
                }
                // Confirm event if sustained for persistence count
                if (engine.candidateCount >= ANOMALY_PERSISTENCE_COUNT) {
                    engine.state             = STATE_DETECTED_EVENT;
                    engine.eventStartTime    = timestampMs;
                    engine.inCooldown        = false;
                    engine.eventCounter++;
#if DEBUG_MODE
                    Serial.print(F("[ANOMALY] EVENT TRIGGERED #"));
                    Serial.print(engine.eventCounter);
                    Serial.print(F(" | Peak Dev: "));
                    Serial.print(engine.peakDeviation, 2);
                    Serial.println(F(" uT"));
#endif
                }
            } else {
                // False alarm or brief transient: decay candidate counter
                if (engine.candidateCount > 0) engine.candidateCount--;
                if (engine.candidateCount == 0) {
                    engine.state         = STATE_NORMAL;
                    engine.peakDeviation = 0.0f;
                }
            }
            break;

        case STATE_DETECTED_EVENT:
            if (fabsf(dev) > engine.peakDeviation) {
                engine.peakDeviation = fabsf(dev);
            }

            if (exceedsThreshold) {
                // Still actively above threshold: reset cooldown
                engine.inCooldown = false;
            } else {
                // Signal returned to normal baseline envelope: enter post-trigger cooldown
                if (!engine.inCooldown) {
                    engine.inCooldown        = true;
                    engine.cooldownStartTime = timestampMs;
#if DEBUG_MODE
                    Serial.println(F("[ANOMALY] Anomaly cleared threshold. Starting 5s post-trigger cooldown..."));
#endif
                } else {
                    // Check if 5-second post-trigger recording has elapsed
                    if (timestampMs - engine.cooldownStartTime >= POST_TRIGGER_DURATION_MS) {
                        engine.state             = STATE_NORMAL;
                        engine.inCooldown        = false;
                        engine.candidateCount    = 0;
                        engine.peakDeviation     = 0.0f;
#if DEBUG_MODE
                        Serial.println(F("[ANOMALY] Post-trigger cooldown finished. Returned to NORMAL."));
#endif
                    }
                }
            }
            break;
    }
}

const char* processingStateStr(AnomalyState state) {
    switch (state) {
        case STATE_NORMAL:            return "NORMAL";
        case STATE_ANOMALY_CANDIDATE: return "ANOMALY_CANDIDATE";
        case STATE_DETECTED_EVENT:    return "DETECTED_EVENT";
        default:                      return "UNKNOWN";
    }
}
