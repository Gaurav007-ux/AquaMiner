// =============================================================================
// AQUAYANTRA — event_logger.h
// Circular RAM pre-trigger buffer (250 samples @ 50 Hz = 5 sec) and
// dual-rate logging orchestrator (survey summaries + detailed event files).
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"
#include "storage.h"
#include "processing.h"

struct RingSample {
    uint32_t timestamp_ms;
    uint32_t sequence;
    int16_t  mag_x_raw;
    int16_t  mag_y_raw;
    int16_t  mag_z_raw;
    float    mag_magnitude;
    float    mag_baseline;
    float    mag_deviation;
    float    mag_rate;
    float    noise;
    float    anomaly_score;
    float    pressure_hpa;
    float    temperature_c;
    float    depth_m;
    float    ph;
    float    tds_ppm;
    float    turbidity_ntu;
    float    battery_v;
    float    data_quality;
};

void eventLoggerInit();
void eventLoggerPushSample(const RingSample &sample);
void eventLoggerProcess(const AnomalyEngine &engine, const RingSample &currentSample);
void eventLoggerWriteSurvey(const SurveyRecord &record);
bool eventLoggerIsEventActive();
