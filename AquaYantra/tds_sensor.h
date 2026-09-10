// =============================================================================
// AQUAYANTRA — tds_sensor.h
// Analog Total Dissolved Solids (TDS) driver for STM32F411CEU6 on PA3
// Features: 16x oversampling, temperature compensation via BMP280,
// standard TDS curve, single-point buffer calibration, uncalibrated flag.
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

struct TdsCalibration {
    float factor     = 1.0f;
    bool  calibrated = false;
};

struct TdsData {
    uint16_t rawADC             = 0;
    float    voltage            = 0.0f;
    float    compensatedVoltage = 0.0f;
    float    tdsPPM             = 0.0f;
    float    temperatureC       = 25.0f;
    bool     calibrated         = false;
    bool     valid              = false;
};

void tdsInit();
bool tdsRead(TdsData &data, float currentTempC = 25.0f);
bool tdsCalibrate(float knownPpm, float currentTempC = 25.0f);
void tdsResetCalibration();
bool tdsHealthCheck();
const TdsCalibration& tdsGetCalibration();
void tdsSetCalibration(const TdsCalibration &cal);
