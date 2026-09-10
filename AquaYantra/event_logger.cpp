// =============================================================================
// AQUAYANTRA — event_logger.cpp
// 5-second circular RAM buffer and dual-mode logging orchestrator
// =============================================================================
#include "event_logger.h"
#include "communication.h"

static RingSample _ringBuffer[PRE_TRIGGER_SAMPLES];
static uint16_t   _ringHead           = 0;
static uint16_t   _ringCount          = 0;
static bool       _eventLoggingActive = false;
static uint32_t   _activeEventId      = 0;

void eventLoggerInit() {
    _ringHead           = 0;
    _ringCount          = 0;
    _eventLoggingActive = false;
    _activeEventId      = 0;
#if DEBUG_MODE
    DualSerial.println(F("[LOGGER] 5-second circular RAM buffer initialized (250 samples @ 50 Hz)."));
#endif
}

void eventLoggerPushSample(const RingSample &sample) {
    _ringBuffer[_ringHead] = sample;
    _ringHead = (_ringHead + 1) % PRE_TRIGGER_SAMPLES;
    if (_ringCount < PRE_TRIGGER_SAMPLES) {
        _ringCount++;
    }
}

void eventLoggerProcess(const AnomalyEngine &engine, const RingSample &currentSample) {
    // Check state machine
    if (engine.state == STATE_DETECTED_EVENT) {
        if (!_eventLoggingActive) {
            // Transition from NORMAL/CANDIDATE to DETECTED_EVENT!
            _eventLoggingActive = true;
            _activeEventId      = engine.eventCounter;

            if (sdIsAvailable()) {
                // Open new event file
                if (sdOpenNextEventFile(_activeEventId)) {
                    // 1. Dump circular pre-trigger buffer (chronological order)
                    uint16_t startIdx = (_ringHead - _ringCount + PRE_TRIGGER_SAMPLES) % PRE_TRIGGER_SAMPLES;
                    for (uint16_t i = 0; i < _ringCount; i++) {
                        uint16_t idx = (startIdx + i) % PRE_TRIGGER_SAMPLES;
                        const RingSample &rs = _ringBuffer[idx];

                        EventSample es;
                        es.timestamp_ms   = rs.timestamp_ms;
                        es.sequence       = rs.sequence;
                        es.mag_x_raw      = rs.mag_x_raw;
                        es.mag_y_raw      = rs.mag_y_raw;
                        es.mag_z_raw      = rs.mag_z_raw;
                        es.mag_magnitude  = rs.mag_magnitude;
                        es.mag_baseline   = rs.mag_baseline;
                        es.mag_deviation  = rs.mag_deviation;
                        es.mag_rate       = rs.mag_rate;
                        es.noise          = rs.noise;
                        es.anomaly_score  = rs.anomaly_score;
                        es.pressure_hpa   = rs.pressure_hpa;
                        es.temperature_c  = rs.temperature_c;
                        es.depth_m        = rs.depth_m;
                        es.ph             = rs.ph;
                        es.tds_ppm        = rs.tds_ppm;
                        es.turbidity_ntu  = rs.turbidity_ntu;
                        es.battery_v      = rs.battery_v;
                        es.data_quality   = rs.data_quality;
                        sdWriteEventSample(es);
                    }
                }
            }
        }

        // 2. Stream current 50 Hz sample
        if (_eventLoggingActive && sdIsAvailable()) {
            EventSample es;
            es.timestamp_ms   = currentSample.timestamp_ms;
            es.sequence       = currentSample.sequence;
            es.mag_x_raw      = currentSample.mag_x_raw;
            es.mag_y_raw      = currentSample.mag_y_raw;
            es.mag_z_raw      = currentSample.mag_z_raw;
            es.mag_magnitude  = currentSample.mag_magnitude;
            es.mag_baseline   = currentSample.mag_baseline;
            es.mag_deviation  = currentSample.mag_deviation;
            es.mag_rate       = currentSample.mag_rate;
            es.noise          = currentSample.noise;
            es.anomaly_score  = currentSample.anomaly_score;
            es.pressure_hpa   = currentSample.pressure_hpa;
            es.temperature_c  = currentSample.temperature_c;
            es.depth_m        = currentSample.depth_m;
            es.ph             = currentSample.ph;
            es.tds_ppm        = currentSample.tds_ppm;
            es.turbidity_ntu  = currentSample.turbidity_ntu;
            es.battery_v      = currentSample.battery_v;
            es.data_quality   = currentSample.data_quality;
            sdWriteEventSample(es);
        }

    } else {
        // Not in DETECTED_EVENT state
        if (_eventLoggingActive) {
            // Event has just completed its post-trigger cooldown and returned to NORMAL
            _eventLoggingActive = false;
            sdCloseEventFile();
        }
    }
}

void eventLoggerWriteSurvey(const SurveyRecord &record) {
    if (sdIsAvailable() && sdLoggingActive()) {
        sdWriteSurveyRecord(record);
    }
}

bool eventLoggerIsEventActive() {
    return _eventLoggingActive;
}
