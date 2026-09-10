// =============================================================================
// AQUAYANTRA — battery.cpp
// =============================================================================
#include "battery.h"

void batteryInit() {
    pinMode(PIN_BATTERY_ADC, INPUT_ANALOG);
#if DEBUG_MODE
    Serial.println(F("[BAT] Battery ADC initialized on PA1 (ADC1 Channel 1)."));
    Serial.print(F("[BAT] Divider: R1=33k, R2=10k, Multiplier="));
    Serial.println(BATTERY_MULTIPLIER, 3);
#endif
}

bool batteryRead(BatteryData &data) {
    uint32_t sum = 0;
    for (int i = 0; i < BATTERY_SAMPLES_COUNT; i++) {
        sum += analogRead(PIN_BATTERY_ADC);
        delayMicroseconds(100);
    }
    float adcRaw = (float)sum / (float)BATTERY_SAMPLES_COUNT;

    // ADC voltage at PA1
    float vadcPin = (adcRaw / ADC_RESOLUTION) * ADC_VREF;

    // Vin = Vout * (R1 + R2) / R2
    data.voltage = vadcPin * BATTERY_MULTIPLIER;

    // Sanity bounds
    if (data.voltage < 0.5f || data.voltage > 20.0f) {
        data.valid = false;
        return false;
    }

    // Percentage estimation for 3S Li-ion battery (9.0V empty to 12.6V full)
    float span = BATTERY_FULL_VOLTAGE - BATTERY_EMPTY_VOLTAGE;
    if (span <= 0.0f) span = 1.0f;
    data.percent = ((data.voltage - BATTERY_EMPTY_VOLTAGE) / span) * 100.0f;
    if (data.percent > 100.0f) data.percent = 100.0f;
    if (data.percent < 0.0f)   data.percent = 0.0f;

    // State evaluation
    if (data.voltage <= BATTERY_CRITICAL_VOLTAGE)
        data.state = BATTERY_CRITICAL;
    else if (data.voltage <= BATTERY_LOW_VOLTAGE)
        data.state = BATTERY_LOW;
    else
        data.state = BATTERY_OK;

    data.valid = true;
    return true;
}

bool batteryHealthCheck() {
    uint16_t raw = analogRead(PIN_BATTERY_ADC);
    return (raw > 0);
}

const char* batteryStateStr(BatteryState s) {
    switch (s) {
        case BATTERY_OK:       return "OK";
        case BATTERY_LOW:      return "LOW";
        case BATTERY_CRITICAL: return "CRITICAL";
        default:               return "UNKNOWN";
    }
}
