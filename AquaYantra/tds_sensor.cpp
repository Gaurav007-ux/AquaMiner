// =============================================================================
// AQUAYANTRA — tds_sensor.cpp
// Analog TDS Sensor implementation for STM32F411CEU6 on PA3
// =============================================================================
#include "tds_sensor.h"

static TdsCalibration _tdsCal;

void tdsInit() {
    pinMode(PIN_TDS_ADC, INPUT_ANALOG);
#if DEBUG_MODE
    Serial.println(F("[TDS] TDS ADC initialized on PA3 (ADC1 Channel 3)."));
    Serial.println(F("[TDS] Safety Notice: Ensure conditioning board output <= 3.3V."));
#endif
}

bool tdsRead(TdsData &data, float currentTempC) {
    uint32_t sum = 0;
    for (int i = 0; i < TDS_AVG_SAMPLES; i++) {
        sum += analogRead(PIN_TDS_ADC);
        delayMicroseconds(100);
    }
    uint16_t avgRaw = (uint16_t)(sum / TDS_AVG_SAMPLES);

    if (avgRaw > 4095) {
        data.valid = false;
        return false;
    }

    data.rawADC = avgRaw;
    data.voltage = ((float)avgRaw / ADC_RESOLUTION) * ADC_VREF / TDS_DIVIDER_RATIO;
    data.temperatureC = currentTempC;
    data.calibrated = _tdsCal.calibrated;

    // Standard water conductivity temperature compensation formula:
    // fComp = 1.0 + 0.02 * (T - 25.0)
    float tempCompFactor = 1.0f + 0.02f * (currentTempC - 25.0f);
    if (tempCompFactor < 0.5f) tempCompFactor = 0.5f; // Clamp to prevent division anomaly

    float compVoltage = data.voltage / tempCompFactor;
    data.compensatedVoltage = compVoltage;

    // Standard polynomial conversion from compensated voltage (0-2.3V) to TDS ppm:
    // TDS = (133.42 * V^3 - 255.86 * V^2 + 857.39 * V) * 0.5 * factor
    float v = compVoltage;
    float v2 = v * v;
    float v3 = v2 * v;
    float rawTds = (133.42f * v3 - 255.86f * v2 + 857.39f * v) * 0.5f;

    if (rawTds < 0.0f) rawTds = 0.0f;

    data.tdsPPM = rawTds * _tdsCal.factor;
    data.valid = true;
    return true;
}

bool tdsCalibrate(float knownPpm, float currentTempC) {
    if (knownPpm <= 0.0f) {
        Serial.println(F("[TDS] ERROR: Known PPM must be greater than 0."));
        return false;
    }

    Serial.print(F("[TDS] Calibrating against standard solution: "));
    Serial.print(knownPpm, 1);
    Serial.println(F(" ppm..."));

    uint32_t sum = 0;
    for (int i = 0; i < 64; i++) {
        sum += analogRead(PIN_TDS_ADC);
        delay(10);
    }
    float avgRaw = (float)sum / 64.0f;
    float v = (avgRaw / ADC_RESOLUTION) * ADC_VREF / TDS_DIVIDER_RATIO;

    float tempCompFactor = 1.0f + 0.02f * (currentTempC - 25.0f);
    if (tempCompFactor < 0.5f) tempCompFactor = 0.5f;
    float compV = v / tempCompFactor;

    float v2 = compV * compV;
    float v3 = v2 * compV;
    float rawTds = (133.42f * v3 - 255.86f * v2 + 857.39f * v) * 0.5f;

    if (rawTds <= 5.0f) {
        Serial.println(F("[TDS] ERROR: Measured voltage too low. Probe not immersed or open."));
        return false;
    }

    _tdsCal.factor = knownPpm / rawTds;
    _tdsCal.calibrated = true;

    Serial.print(F("[TDS] Calibration factor computed: "));
    Serial.println(_tdsCal.factor, 4);
    Serial.println(F("[TDS] Calibration Successful."));
    return true;
}

void tdsResetCalibration() {
    _tdsCal.factor = 1.0f;
    _tdsCal.calibrated = false;
    Serial.println(F("[TDS] Calibration reset to factor 1.0 (UNCALIBRATED)."));
}

bool tdsHealthCheck() {
    uint16_t raw = analogRead(PIN_TDS_ADC);
    // 4095 means sensor pin shorted directly to 3.3V VDD
    if (raw >= 4090) {
        return false;
    }
    return true;
}

const TdsCalibration& tdsGetCalibration() {
    return _tdsCal;
}

void tdsSetCalibration(const TdsCalibration &cal) {
    _tdsCal = cal;
}
