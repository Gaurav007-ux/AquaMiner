// =============================================================================
// AQUAYANTRA — pressure.h
// BMP280 pressure, temperature, and shallow depth estimation
// =============================================================================
#pragma once
#include <Arduino.h>
#include <Adafruit_BMP280.h>
#include "config.h"

struct PressureData {
    float pressureHPa  = 0.0f;
    float temperatureC = 0.0f;
    float depthM       = 0.0f;   // shallow prototype context only (< 1m water)
    bool  valid        = false;
};

bool pressureInit(uint8_t &foundAddr);
bool pressureRead(PressureData &data);
void pressureSetSurface(float &surfacePressureHPa);
bool pressureHealthCheck();
