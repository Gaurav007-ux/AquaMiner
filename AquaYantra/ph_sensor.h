// =============================================================================
// AQUAYANTRA — ph_sensor.h
// Analog pH Sensor driver for STM32F411CEU6 on PA2
// Features: 16x oversampling, Nernstian temperature compensation,
// 2-point calibration (pH 7.00 / 4.01), uncalibrated safety flags.
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

struct PhCalibration {
    float neutralVoltage = PH_NEUTRAL_VOLTAGE; // V at pH 7.00
    float acidVoltage    = PH_ACID_VOLTAGE;    // V at pH 4.01
    float slope          = -5.70f;             // pH units per Volt
    bool  calibrated     = false;
};

struct PhData {
    uint16_t rawADC       = 0;
    float    voltage      = 0.0f;
    float    pH           = 7.00f;
    float    temperatureC = 25.0f;
    bool     calibrated   = false;
    bool     valid        = false;
};

void phInit();
bool phRead(PhData &data, float currentTempC = 25.0f);
bool phCalibrateNeutral();
bool phCalibrateAcid();
void phResetCalibration();
bool phHealthCheck();
const PhCalibration& phGetCalibration();
void phSetCalibration(const PhCalibration &cal);
