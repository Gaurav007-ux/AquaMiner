// =============================================================================
// AQUAYANTRA — turbidity.cpp
// =============================================================================
#include "turbidity.h"

static bool _turbCalibrated = false;

void turbidityInit() {
    pinMode(PIN_TURBIDITY_ADC, INPUT_ANALOG);
#if DEBUG_MODE
    Serial.println(F("[TURB] Turbidity ADC initialized on PA0."));
    Serial.println(F("[TURB] Safety: Confirm sensor AO output <= 3.3V."));
#endif
}

bool turbidityRead(TurbidityData &data) {
    uint32_t sum = 0;
    for (int i = 0; i < TURBIDITY_AVG_SAMPLES; i++) {
        sum += analogRead(PIN_TURBIDITY_ADC);
        delayMicroseconds(100);
    }
    uint16_t avg = (uint16_t)(sum / TURBIDITY_AVG_SAMPLES);

    if (avg > 4095) {
        data.valid = false;
        return false;
    }

    data.rawADC  = avg;
    data.voltage = ((float)avg / ADC_RESOLUTION) * ADC_VREF / TURBIDITY_DIVIDER_RATIO;
    data.calibrated = _turbCalibrated;

    // Open-circuit detection: voltage near GND means sensor disconnected
    if (data.voltage < 0.30f) {
        data.ntu = 0.0f;
        data.valid = false;
        return false;
    }

    // Standard optical turbidity conversion (approximation):
    // In clean water, voltage is high (~2.8V - 3.0V).
    // In murky/turbid water, voltage drops.
    float v = data.voltage;
    float ntuCalc = 0.0f;
    if (v < 2.5f) {
        // Curve: NTU = 3000 * (1 - v/2.5) approx
        ntuCalc = -1120.4f * (v * v) + 5742.3f * v - 4352.9f;
        if (ntuCalc < 0.0f) ntuCalc = 0.0f;
        if (ntuCalc > 3000.0f) ntuCalc = 3000.0f;
    } else {
        ntuCalc = 0.0f; // Clear water
    }

    // Sensor-in-air detection: the polynomial produces unrealistically high
    // NTU values at intermediate voltages when the probe is not submerged.
    // Real water turbidity above 1000 NTU is extremely rare; reject it.
    if (ntuCalc > 1000.0f) {
        data.ntu = ntuCalc;
        data.valid = false;
        return false;
    }

    data.ntu = ntuCalc;
    data.valid = true;
    return true;
}

bool turbidityHealthCheck() {
    uint16_t raw = analogRead(PIN_TURBIDITY_ADC);
    // 4095 is shorted to VDD
    if (raw >= 4090) return false;
    return true;
}

void turbiditySetCalibrated(bool cal) {
    _turbCalibrated = cal;
}
