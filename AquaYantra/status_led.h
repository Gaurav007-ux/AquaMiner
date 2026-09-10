// =============================================================================
// AQUAYANTRA — status_led.h
// Centralized system status LED controller for STM32F411CEU6 Black Pill
// Hardware: PB0 -> 220 Ohm resistor -> LED Anode (+), Cathode (-) -> GND
// PB0 HIGH = LED ON, PB0 LOW = LED OFF
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

enum LedState {
    LED_STARTUP,            // Initial power-up blink sequence
    LED_SENSOR_ERROR,       // Required sensor failed: 500 ms ON / 500 ms OFF
    LED_CALIBRATING,        // Baseline/Mag calibration: 250 ms ON / 750 ms OFF
    LED_READY,              // Normal monitoring mode: Continuously ON
    LED_ANOMALY_CANDIDATE,  // Anomaly candidate: 200 ms ON / 800 ms OFF
    LED_EVENT,              // Confirmed anomaly event recording: 100 ms ON / 100 ms OFF
    LED_SD_ERROR            // MicroSD fault/full: 100ms ON / 100ms OFF / 100ms ON / 700ms OFF
};

void     ledInit();
void     ledIndicateStartup();   // 100 ms ON -> 100 ms OFF x 3 in setup()
void     ledIndicateSensorsOk(); // 500 ms ON in setup()
void     setLedState(LedState state);
LedState getLedState();
void     updateLed();            // Completely non-blocking, called frequently in loop()
