// =============================================================================
// AQUAYANTRA — turbidity.h
// Analog turbidity sensor on PA0 (ADC1 Channel 0)
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

struct TurbidityData {
    uint16_t rawADC     = 0;
    float    voltage    = 0.0f;
    float    ntu        = 0.0f;
    bool     calibrated = false;
    bool     valid      = false;
};

void turbidityInit();
bool turbidityRead(TurbidityData &data);
bool turbidityHealthCheck();
void turbiditySetCalibrated(bool cal);
