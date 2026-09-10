// =============================================================================
// AQUAYANTRA — storage.h
// MicroSD storage subsystem via SPI1 (PA5=SCK, PA6=MISO, PA7=MOSI, PA4=CS)
// Handles sequential survey summaries (/AQUAYANTRA/SURVEY/SURVEY_xxx.CSV)
// and detailed high-rate anomaly records (/AQUAYANTRA/EVENTS/EVENT_xxx.CSV).
// Fully resilient to SD disconnect, full card, or write errors.
// =============================================================================
#pragma once
#include <Arduino.h>
#include <SD.h>
#include <SPI.h>
#include "config.h"
#include "magnetometer.h"
#include "ph_sensor.h"
#include "tds_sensor.h"

// Survey Summary Record (logged at 0.5 Hz / every 2-5 sec to SURVEY_xxx.CSV)
struct SurveyRecord {
    uint32_t timestamp_ms;
    uint32_t sequence;
    float    depth_m;
    float    mag_mean;
    float    mag_min;
    float    mag_max;
    float    mag_std;
    float    temperature_c;
    float    ph;
    float    tds_ppm;
    float    turbidity_ntu;
    float    battery_v;
};

// High-rate Event Sample (logged at 50 Hz to EVENT_xxx.CSV)
struct EventSample {
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

bool sdInit();
bool sdIsAvailable();
bool sdLoggingActive();
void sdStartLogging();
void sdStopLogging();
const char* sdGetCurrentSurveyFile();
const char* sdGetCurrentEventFile();

bool sdWriteSurveyRecord(const SurveyRecord &r);
bool sdOpenNextEventFile(uint32_t eventId);
bool sdWriteEventSample(const EventSample &s);
void sdCloseEventFile();
bool sdIsEventFileOpen();

bool sdSaveCalibration(const MagCalibration &cal);
bool sdLoadCalibration(MagCalibration &cal);
bool sdSaveSensorCalibration(const PhCalibration &phCal, const TdsCalibration &tdsCal);
bool sdLoadSensorCalibration(PhCalibration &phCal, TdsCalibration &tdsCal);
