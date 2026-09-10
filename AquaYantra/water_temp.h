// =============================================================================
// AQUAYANTRA — water_temp.h
// Dedicated 1-Wire DS18B20 digital waterproof temperature sensor driver.
// Hardware: PB9 (with mandatory 4.7k pull-up resistor to 3.3V).
// Asynchronous non-blocking conversion protects 50 Hz magnetometer timing.
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

struct WaterTempData {
    float    temperatureC = 25.0f;
    bool     valid        = false;
    uint32_t lastReadMs   = 0;
};

bool waterTempInit();
void waterTempUpdate();               // Non-blocking state machine polled in loop
bool waterTempRead(WaterTempData &data);
bool waterTempHealthCheck();
