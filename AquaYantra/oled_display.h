// =============================================================================
// AQUAYANTRA — oled_display.h
// 0.96-inch SSD1306 128x64 OLED Measurement Display
// Dedicated exclusively to displaying clear, stable, real-time sensor values.
// Non-blocking, independent 1 Hz refresh, human-readable screens, zero flickering.
// =============================================================================
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

enum OledScreen {
    SCREEN_SYSTEM = 0,       // SCREEN 1: System Overview (Depth, Temp, Batt, SD)
    SCREEN_MAGNETIC,         // SCREEN 2: Magnetic Field (X, Y, Z, Magnitude, Heading)
    SCREEN_WATER_QUALITY,    // SCREEN 3: Water Quality (pH, TDS, Turbidity, Temp)
    SCREEN_PRESSURE_DEPTH,   // SCREEN 4: Pressure & Depth (Depth, Pressure, Temp)
    SCREEN_COUNT
};

struct OledData {
    // Magnetic measurements
    int16_t     magRawX;
    int16_t     magRawY;
    int16_t     magRawZ;
    float       magField;
    float       headingDeg;
    const char* cardinal;

    // Environmental / context values
    float       depthM;
    float       pressureHPa;
    float       tempC;
    float       ph;
    float       tdsPPM;
    float       turbidityNTU;

    // Power & SD logging state
    float       batteryV;
    float       batteryPct;
    bool        sdLogging;
    bool        sdOk;
    bool        sensorsOk;
};

// Driver Lifecycle & Display Updates
bool oledInit();
bool oledIsAvailable();
void oledShowSplash();
void oledShowStartupCountdown(uint8_t secondsRemaining);
void oledShowSystemReady(bool sdOk, bool sensorsOk, bool baselineOk);
void oledUpdate(const OledData &data);
void oledNextScreen();
void oledSetScreen(OledScreen screen);
OledScreen oledGetCurrentScreen();
