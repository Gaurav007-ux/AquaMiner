// =============================================================================
// AQUAYANTRA — status_led.cpp
// Centralized system status LED implementation for STM32F411CEU6 on PB0
// =============================================================================
#include "status_led.h"

static LedState _currentLedState = LED_STARTUP;
static uint32_t _stateStartMs    = 0;

void ledInit() {
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW); // Start with LED OFF
    _currentLedState = LED_STARTUP;
    _stateStartMs    = millis();
}

void ledIndicateStartup() {
    // 100 ms ON -> 100 ms OFF repeated 3 times during startup sequence
    for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_STATUS_LED, HIGH);
        delay(100);
        digitalWrite(PIN_STATUS_LED, LOW);
        delay(100);
    }
}

void ledIndicateSensorsOk() {
    // Solid ON briefly for 500 ms when required sensors pass initialization
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(500);
    digitalWrite(PIN_STATUS_LED, LOW);
}

void setLedState(LedState state) {
    if (_currentLedState != state) {
        _currentLedState = state;
        _stateStartMs    = millis();
    }
}

LedState getLedState() {
    return _currentLedState;
}

void updateLed() {
    uint32_t now = millis();
    uint32_t elapsed = now - _stateStartMs;

    switch (_currentLedState) {
        case LED_READY:
            // Continuous ON: System ready and in normal monitoring mode
            digitalWrite(PIN_STATUS_LED, HIGH);
            break;

        case LED_SENSOR_ERROR: {
            // Required sensor failed: 500 ms ON -> 500 ms OFF (period = 1000 ms)
            uint32_t phase = elapsed % 1000;
            digitalWrite(PIN_STATUS_LED, (phase < 500) ? HIGH : LOW);
            break;
        }

        case LED_CALIBRATING: {
            // Baseline / 3D Magnetometer calibration: 250 ms ON -> 750 ms OFF (period = 1000 ms)
            uint32_t phase = elapsed % 1000;
            digitalWrite(PIN_STATUS_LED, (phase < 250) ? HIGH : LOW);
            break;
        }

        case LED_ANOMALY_CANDIDATE: {
            // Anomaly candidate: 200 ms ON -> 800 ms OFF (period = 1000 ms)
            uint32_t phase = elapsed % 1000;
            digitalWrite(PIN_STATUS_LED, (phase < 200) ? HIGH : LOW);
            break;
        }

        case LED_EVENT: {
            // Detected event active recording: 100 ms ON -> 100 ms OFF (period = 200 ms)
            uint32_t phase = elapsed % 200;
            digitalWrite(PIN_STATUS_LED, (phase < 100) ? HIGH : LOW);
            break;
        }

        case LED_SD_ERROR: {
            // MicroSD fault / full: 100 ms ON -> 100 ms OFF -> 100 ms ON -> 700 ms OFF (period = 1000 ms)
            uint32_t phase = elapsed % 1000;
            bool on = (phase < 100) || (phase >= 200 && phase < 300);
            digitalWrite(PIN_STATUS_LED, on ? HIGH : LOW);
            break;
        }

        case LED_STARTUP:
        default:
            digitalWrite(PIN_STATUS_LED, LOW);
            break;
    }
}
