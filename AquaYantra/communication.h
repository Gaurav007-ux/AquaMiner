// =============================================================================
// AQUAYANTRA — communication.h
// Serial CLI, live terminal monitor, and JSON Lines streaming
// Dual-MCU note: All GPS logic removed. USART1 reserved for ESP32 surface node.
// =============================================================================
#pragma once
#include <Arduino.h>
#include "config.h"
#include "magnetometer.h"
#include "pressure.h"
#include "water_temp.h"
#include "turbidity.h"
#include "ph_sensor.h"
#include "tds_sensor.h"
#include "battery.h"
#include "storage.h"
#include "health.h"
#include "processing.h"
#include "Serial.h"

struct SystemState {
    MagData         &mag;
    MagCalibration  &cal;
    BaselineTracker &tracker;
    AnomalyEngine   &anomaly;
    PressureData    &pressure;
    WaterTempData   &waterTemp;
    TurbidityData   &turbidity;
    PhData          &ph;
    TdsData         &tds;
    BatteryData     &battery;
    SystemHealth    &health;
    float           &surfacePressure;
    float           &dataQuality;
};

extern Uart SerialFTDI;

class DualSerialPort : public Print {
public:
    void begin(unsigned long baud);
    virtual size_t write(uint8_t c) override;
    virtual size_t write(const uint8_t *buffer, size_t size) override;
    void flush();
    int available();
    int read();
    operator bool() { return true; }
};

extern DualSerialPort DualSerial;

void commPrintHelp();
void commParseCommand(const String &cmd, SystemState &state);
void commPrintHumanReadable(const SystemState &state, uint32_t sequence);
void commPrintJSON(const SystemState &state, uint32_t sequence);
void commPrintBootBanner(const SystemHealth &h, const BatteryData &bat,
                         const MagCalibration &cal, const PhCalibration &phCal,
                         const TdsCalibration &tdsCal);
void commScanI2C();
