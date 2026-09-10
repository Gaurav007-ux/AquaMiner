// =============================================================================
// AQUAYANTRA — battery.h
// Battery voltage monitoring via 33k/10k voltage divider on PA1
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"

enum BatteryState {
    BATTERY_OK,
    BATTERY_LOW,
    BATTERY_CRITICAL
};

struct BatteryData {
    float        voltage = 0.0f;
    float        percent = 0.0f;
    BatteryState state   = BATTERY_OK;
    bool         valid   = false;
};

void        batteryInit();
bool        batteryRead(BatteryData &data);
bool        batteryHealthCheck();
const char* batteryStateStr(BatteryState s);
