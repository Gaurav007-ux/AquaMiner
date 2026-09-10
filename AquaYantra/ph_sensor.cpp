// =============================================================================
// AQUAYANTRA — ph_sensor.cpp
// Analog pH Sensor implementation for STM32F411CEU6 on PA2
// =============================================================================
#include "ph_sensor.h"

static PhCalibration _phCal;

void phInit() {
    pinMode(PIN_PH_ADC, INPUT_ANALOG);
#if DEBUG_MODE
    Serial.println(F("[PH] pH ADC initialized on PA2 (ADC1 Channel 2)."));
    Serial.println(F("[PH] Safety Notice: Ensure conditioning board output <= 3.3V."));
#endif
}

bool phRead(PhData &data, float currentTempC) {
    uint32_t sum = 0;
    for (int i = 0; i < PH_AVG_SAMPLES; i++) {
        sum += analogRead(PIN_PH_ADC);
        delayMicroseconds(100);
    }
    uint16_t avgRaw = (uint16_t)(sum / PH_AVG_SAMPLES);

    // Sanity check on raw 12-bit ADC range
    if (avgRaw > 4095) {
        data.valid = false;
        return false;
    }

    data.rawADC = avgRaw;
    // Calculate analog pin voltage with divider scaling
    data.voltage = ((float)avgRaw / ADC_RESOLUTION) * ADC_VREF / PH_DIVIDER_RATIO;
    data.temperatureC = currentTempC;
    data.calibrated = _phCal.calibrated;

    // Open-circuit / no-probe detection:
    // If voltage is near GND (<0.1V) or near VCC (>3.1V), the probe is
    // disconnected, in air, or the conditioning board has no signal.
    if (data.voltage < 0.10f || data.voltage > 3.10f) {
        data.pH = 0.0f;
        data.valid = false;
        return false;
    }

    // Standard temperature in Kelvin
    float tempK = currentTempC + 273.15f;
    if (tempK < 273.15f) tempK = 273.15f; // Clamp to 0°C min
    if (tempK > 353.15f) tempK = 353.15f; // Clamp to 80°C max

    // Temperature compensation factor relative to 25°C (298.15 K)
    // Nernst slope increases linearly with absolute temperature
    float tempFactor = 298.15f / tempK;

    // Calculate pH: pH = 7.00 + (V_measured - V_neutral) * slope * tempFactor
    float calculatedPH = 7.00f + (data.voltage - _phCal.neutralVoltage) * _phCal.slope * tempFactor;

    // If computed pH hits clamp limits, the reading is unreliable
    if (calculatedPH < 0.5f || calculatedPH > 13.5f) {
        data.pH = calculatedPH < 0.5f ? 0.0f : 14.0f;
        data.valid = false;
        return false;
    }

    // Clamp pH to physical realistic limits (0.0 to 14.0)
    if (calculatedPH < 0.0f)  calculatedPH = 0.0f;
    if (calculatedPH > 14.0f) calculatedPH = 14.0f;

    data.pH = calculatedPH;
    data.valid = true;
    return true;
}

bool phCalibrateNeutral() {
    Serial.println(F("[PH] Calibrating pH 7.00 (Neutral point)... keep probe in buffer."));
    uint32_t sum = 0;
    for (int i = 0; i < 64; i++) {
        sum += analogRead(PIN_PH_ADC);
        delay(10);
    }
    float avgRaw = (float)sum / 64.0f;
    float v = (avgRaw / ADC_RESOLUTION) * ADC_VREF / PH_DIVIDER_RATIO;

    // Sanity check: pH 7 voltage is typically around 1.2V - 1.8V on standard 3.3V modules
    if (v < 0.8f || v > 2.5f) {
        Serial.print(F("[PH] ERROR: Neutral voltage out of range: "));
        Serial.print(v, 3);
        Serial.println(F(" V. Calibration aborted."));
        return false;
    }

    _phCal.neutralVoltage = v;
    Serial.print(F("[PH] Neutral voltage (pH 7.00) calibrated: "));
    Serial.print(_phCal.neutralVoltage, 3);
    Serial.println(F(" V"));
    return true;
}

bool phCalibrateAcid() {
    Serial.println(F("[PH] Calibrating pH 4.01 (Acid point)... keep probe in buffer."));
    uint32_t sum = 0;
    for (int i = 0; i < 64; i++) {
        sum += analogRead(PIN_PH_ADC);
        delay(10);
    }
    float avgRaw = (float)sum / 64.0f;
    float v = (avgRaw / ADC_RESOLUTION) * ADC_VREF / PH_DIVIDER_RATIO;

    if (fabsf(v - _phCal.neutralVoltage) < 0.1f) {
        Serial.println(F("[PH] ERROR: Acid voltage too close to neutral voltage. Probe error."));
        return false;
    }

    _phCal.acidVoltage = v;
    // Calculate new slope: (4.01 - 7.00) / (acidVoltage - neutralVoltage)
    _phCal.slope = (4.01f - 7.00f) / (_phCal.acidVoltage - _phCal.neutralVoltage);
    _phCal.calibrated = true;

    Serial.print(F("[PH] Acid voltage (pH 4.01) calibrated: "));
    Serial.print(_phCal.acidVoltage, 3);
    Serial.println(F(" V"));
    Serial.print(F("[PH] Calculated slope: "));
    Serial.print(_phCal.slope, 3);
    Serial.println(F(" pH/V"));
    Serial.println(F("[PH] 2-Point Calibration Complete."));
    return true;
}

void phResetCalibration() {
    _phCal.neutralVoltage = PH_NEUTRAL_VOLTAGE;
    _phCal.acidVoltage    = PH_ACID_VOLTAGE;
    _phCal.slope          = (4.01f - 7.00f) / (PH_ACID_VOLTAGE - PH_NEUTRAL_VOLTAGE);
    _phCal.calibrated     = false;
    Serial.println(F("[PH] Calibration reset to default factory constants (UNCALIBRATED)."));
}

bool phHealthCheck() {
    uint16_t raw = analogRead(PIN_PH_ADC);
    // Open circuit or shorted to GND or VDD (0 or 4095) indicates fault
    if (raw == 0 || raw >= 4090) {
        return false;
    }
    return true;
}

const PhCalibration& phGetCalibration() {
    return _phCal;
}

void phSetCalibration(const PhCalibration &cal) {
    _phCal = cal;
}
