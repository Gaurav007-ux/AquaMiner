// =============================================================================
// AQUAYANTRA — pressure.cpp
// BMP280 pressure, temperature, and shallow depth estimation
// Supports both 0x76 (SDO=GND) and 0x77 (SDO=3.3V) with chip ID verification.
// =============================================================================
#include "pressure.h"

static Adafruit_BMP280 _bmp(&Wire);
static bool            _bmpOk = false;
static float           _surfacePressureHPa = 1013.25f;

bool pressureInit(uint8_t &foundAddr) {
    foundAddr = 0;
    _bmpOk    = false;

    // 1. Probe 0x76 (SDO tied to GND)
    Serial.println(F("[BMP280] Trying 0x76..."));
    Wire.beginTransmission(BMP280_ADDR_LOW);
    uint8_t err76 = Wire.endTransmission();

    // 2. Probe 0x77 (SDO tied to 3.3V or pulled high)
    Serial.println(F("[BMP280] Trying 0x77..."));
    Wire.beginTransmission(BMP280_ADDR_HIGH);
    uint8_t err77 = Wire.endTransmission();

    uint8_t targetAddr = 0;
    if (err76 == 0) {
        targetAddr = BMP280_ADDR_LOW;
    } else if (err77 == 0) {
        targetAddr = BMP280_ADDR_HIGH;
    } else {
        Serial.println(F("[BMP280] ERROR: No response at 0x76 or 0x77."));
        Serial.println(F("[BMP280] Diagnostic checks:"));
        Serial.println(F(" 1. Check 3.3V and GND power connections."));
        Serial.println(F(" 2. Confirm I2C wiring: SCL -> PB6, SDA -> PB7."));
        Serial.println(F(" 3. Confirm 4.7k pull-up resistors are present on SDA and SCL."));
        Serial.println(F(" 4. If your BMP280 module has a CSB pin, it MUST be tied to 3.3V to enable I2C mode!"));
        return false;
    }

    Serial.print(F("[BMP280] Detected at 0x"));
    Serial.println(targetAddr, HEX);

    // 3. Read Hardware Chip ID from register 0xD0
    Wire.beginTransmission(targetAddr);
    Wire.write(0xD0);
    uint8_t chipId = 0xFF;
    if (Wire.endTransmission() == 0) {
        if (Wire.requestFrom((int)targetAddr, 1) == 1) {
            chipId = Wire.read();
        }
    }

    Serial.print(F("[BMP280] Chip ID: 0x"));
    Serial.print(chipId, HEX);
    if (chipId == 0x58) {
        Serial.println(F(" (Standard BMP280)"));
    } else if (chipId == 0x56 || chipId == 0x57) {
        Serial.println(F(" (BMP280 revision / sample)"));
    } else if (chipId == 0x60) {
        Serial.println(F(" (BME280 compatibility mode)"));
    } else {
        Serial.println(F(" (Unknown / Unexpected ID)"));
    }

    // 4. Initialize Adafruit_BMP280 using the detected address and actual hardware chip ID
    uint8_t expectedId = (chipId != 0xFF && chipId != 0x00) ? chipId : 0x58;

    if (!_bmp.begin(targetAddr, expectedId)) {
        Serial.println(F("[BMP280] ERROR: Adafruit_BMP280::begin() verification failed."));
        return false;
    }

    // 5. Configure BMP280 for normal operating mode with 16x oversampling
    _bmp.setSampling(
        Adafruit_BMP280::MODE_NORMAL,
        Adafruit_BMP280::SAMPLING_X2,   // Temperature oversampling 2x
        Adafruit_BMP280::SAMPLING_X16,  // Pressure oversampling 16x
        Adafruit_BMP280::FILTER_X16,    // IIR filter 16x
        Adafruit_BMP280::STANDBY_MS_500 // Standby 500ms
    );

    _bmpOk = true;
    foundAddr = targetAddr;

    // 6. Settle and read baseline surface reference pressure
    delay(100);
    float p = _bmp.readPressure();
    if (!isnan(p) && p > 30000.0f && p < 115000.0f) {
        _surfacePressureHPa = p / 100.0f; // Pa -> hPa
    }

    Serial.println(F("[BMP280] Initialization OK"));
    Serial.print(F("[BMP280] Baseline surface pressure: "));
    Serial.print(_surfacePressureHPa, 2);
    Serial.println(F(" hPa"));

    return true;
}

bool pressureRead(PressureData &data) {
    if (!_bmpOk) {
        data.valid = false;
        return false;
    }

    float pPa = _bmp.readPressure();
    float tC  = _bmp.readTemperature();

    if (isnan(pPa) || isnan(tC) || pPa < 30000.0f || pPa > 115000.0f || tC < -40.0f || tC > 85.0f) {
        data.valid = false;
        return false;
    }

    data.pressureHPa  = pPa / 100.0f;
    data.temperatureC = tC;

    // Hydrostatic depth calculation: dP / (rho * g)
    float dP = pPa - (_surfacePressureHPa * 100.0f);
    data.depthM = dP / (WATER_DENSITY * GRAVITY_ACCEL);
    if (data.depthM < 0.0f) data.depthM = 0.0f;

    data.valid = true;
    return true;
}

void pressureSetSurface(float &surfacePressureHPa) {
    if (!_bmpOk) {
        Serial.println(F("[BMP280] Cannot set surface pressure: sensor offline."));
        return;
    }
    float pPa = _bmp.readPressure();
    if (!isnan(pPa) && pPa > 30000.0f && pPa < 115000.0f) {
        _surfacePressureHPa = pPa / 100.0f;
        surfacePressureHPa  = _surfacePressureHPa;
        Serial.print(F("[BMP280] Surface reference pressure updated: "));
        Serial.print(_surfacePressureHPa, 2);
        Serial.println(F(" hPa"));
    } else {
        Serial.println(F("[BMP280] ERROR: Surface pressure read out of bounds."));
    }
}

bool pressureHealthCheck() {
    if (!_bmpOk) return false;
    float p = _bmp.readPressure();
    return (!isnan(p) && p > 30000.0f && p < 115000.0f);
}
