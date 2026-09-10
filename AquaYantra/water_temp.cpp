// =============================================================================
// AQUAYANTRA — water_temp.cpp
// Implementation of asynchronous DS18B20 1-Wire temperature acquisition
// =============================================================================
#include "water_temp.h"
#include <OneWire.h>
#include <DallasTemperature.h>

static OneWire           _oneWire(PIN_DS18B20);
static DallasTemperature _sensors(&_oneWire);
static WaterTempData     _lastData;
static bool              _sensorFound        = false;
static bool              _conversionPending  = false;
static uint32_t          _conversionStartMs  = 0;

bool waterTempInit() {
    _sensors.begin();
    _sensorFound = (_sensors.getDeviceCount() > 0);

    if (_sensorFound) {
        _sensors.setResolution(12);           // 12-bit resolution: 0.0625°C precision
        _sensors.setWaitForConversion(false); // Enable NON-BLOCKING mode!
        // Start first conversion
        _sensors.requestTemperatures();
        _conversionPending = true;
        _conversionStartMs = millis();
        _lastData.valid = false;
        _lastData.temperatureC = 25.0f;
#if DEBUG_MODE
        Serial.print(F("[TEMP] DS18B20 found on PB9. Devices: "));
        Serial.println(_sensors.getDeviceCount());
#endif
        return true;
    } else {
        _lastData.valid = false;
        _lastData.temperatureC = 25.0f;
#if DEBUG_MODE
        Serial.println(F("[TEMP] WARNING: No DS18B20 found on PB9 (check 4.7k pull-up resistor to 3.3V)."));
#endif
        return false;
    }
}

void waterTempUpdate() {
    if (!_sensorFound) {
        // Periodic check to auto-detect if sensor gets connected
        static uint32_t lastCheckMs = 0;
        if (millis() - lastCheckMs >= 5000) {
            lastCheckMs = millis();
            waterTempInit();
        }
        return;
    }

    uint32_t now = millis();

    if (_conversionPending) {
        // 12-bit conversion requires 750 ms
        if (now - _conversionStartMs >= 750) {
            float tempC = _sensors.getTempCByIndex(0);

            // DS18B20 error codes:
            // DEVICE_DISCONNECTED_C = -127.0f
            // 85.0f is default scratchpad power-on reset value if conversion wasn't ready
            if (tempC != DEVICE_DISCONNECTED_C && tempC > -55.0f && tempC < 125.0f && fabsf(tempC - 85.0f) > 0.001f) {
                _lastData.temperatureC = tempC;
                _lastData.valid        = true;
                _lastData.lastReadMs   = now;
            } else if (tempC == DEVICE_DISCONNECTED_C) {
                _lastData.valid = false;
            }

            // Trigger next conversion
            _sensors.requestTemperatures();
            _conversionPending = true;
            _conversionStartMs = now;
        }
    } else {
        _sensors.requestTemperatures();
        _conversionPending = true;
        _conversionStartMs = now;
    }
}

bool waterTempRead(WaterTempData &data) {
    data = _lastData;
    return _lastData.valid;
}

bool waterTempHealthCheck() {
    return _sensorFound && _lastData.valid && (millis() - _lastData.lastReadMs < 5000);
}
