// =============================================================================
// AQUAYANTRA — magnetometer.cpp
// Multi-device Magnetometer Driver supporting:
//  1. HP5883 / QMC5883P (HW-127 module) at I2C address 0x2C (Primary)
//  2. Honeywell HMC5883L at I2C address 0x1E
//  3. QMC5883L (alternate clone) at I2C address 0x0D
// Includes digital compass heading calculation and hard/soft-iron 3D calibration.
// =============================================================================
#include "magnetometer.h"
#include "storage.h"
#include "status_led.h"
#include <math.h>

static MagType _sensorType = MAG_TYPE_NONE;
static uint8_t _magAddr    = QMC5883P_ADDR;
static bool    _isHmc      = false;

static bool _magWriteReg(uint8_t addr, uint8_t reg, uint8_t val) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.write(val);
    return (Wire.endTransmission() == 0);
}

static bool _magReadRegs(uint8_t addr, uint8_t startReg, uint8_t *buf, uint8_t len) {
    Wire.beginTransmission(addr);
    Wire.write(startReg);
    if (Wire.endTransmission(false) != 0) return false;
    uint8_t readCount = Wire.requestFrom((int)addr, (int)len);
    if (readCount != len) return false;
    for (uint8_t i = 0; i < len; i++) {
        if (!Wire.available()) return false;
        buf[i] = Wire.read();
    }
    return true;
}

const char* magGetSensorName() {
    switch (_sensorType) {
        case MAG_TYPE_QMC5883P: return "HP5883 / QMC5883P (0x2C)";
        case MAG_TYPE_HMC5883L: return "Honeywell HMC5883L (0x1E)";
        case MAG_TYPE_QMC5883L: return "QMC5883L (0x0D)";
        default:                return "NONE / OFFLINE";
    }
}

bool magInit() {
    Serial.println(F("[MAG] Scanning supported magnetometers..."));

    // -------------------------------------------------------------------------
    // 1. Probe for HP5883 / QMC5883P (HW-127 module, primary address 0x2C)
    // -------------------------------------------------------------------------
    Serial.println(F("[MAG] Probing 0x2C (HP5883 / QMC5883P)..."));
    Wire.beginTransmission(QMC5883P_ADDR);
    if (Wire.endTransmission() == 0) {
        // Read chip ID from register 0x00 (expected 0x80)
        uint8_t chipId = 0xFF;
        _magReadRegs(QMC5883P_ADDR, QMC5883P_REG_CHIP_ID, &chipId, 1);

        // Hardware initialization sequence for QMC5883P / HP5883:
        // Step a: Soft Reset
        _magWriteReg(QMC5883P_ADDR, QMC5883P_REG_CTL2, QMC5883P_CTL2_SOFT_RESET);
        delay(15);

        // Step b: Power/Clock stabilization register
        _magWriteReg(QMC5883P_ADDR, 0x0D, 0x40);
        delay(10);

        // Step c: Axis sensitivity trim configuration
        _magWriteReg(QMC5883P_ADDR, QMC5883P_REG_AXIS_CONF, 0x06);
        delay(10);

        // Step d: Control 2 -> ±8 Gauss Range (37.5 LSB/µT), Set/Reset Mode ON
        _magWriteReg(QMC5883P_ADDR, QMC5883P_REG_CTL2, QMC5883P_CTL2_8G_RANGE);
        delay(10);

        // Step e: Control 1 -> Continuous Measurement, 200 Hz ODR, OSR 8
        _magWriteReg(QMC5883P_ADDR, QMC5883P_REG_CTL1, QMC5883P_CTL1_200HZ_CONT);
        delay(15);

        // Verify with test read of 6 bytes from Data Output X LSB register (0x01)
        uint8_t testBuf[6];
        if (_magReadRegs(QMC5883P_ADDR, QMC5883P_REG_XOUT_LSB, testBuf, 6)) {
            _sensorType = MAG_TYPE_QMC5883P;
            _magAddr    = QMC5883P_ADDR;
            _isHmc      = false;

            Serial.print(F("[MAG] HP5883/QMC5883P detected at 0x2C (Chip ID: 0x"));
            Serial.print(chipId, HEX);
            Serial.println(F(")"));
            Serial.println(F("[MAG] Initialization OK"));
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // 2. Probe for Honeywell HMC5883L (Address 0x1E)
    // -------------------------------------------------------------------------
    Serial.println(F("[MAG] Probing 0x1E (Honeywell HMC5883L)..."));
    Wire.beginTransmission(HMC5883L_ADDR);
    if (Wire.endTransmission() == 0) {
        // Config A: 8 samples averaged, 75 Hz data rate, normal bias
        _magWriteReg(HMC5883L_ADDR, HMC_REG_CRA, HMC_CRA_75HZ_8AVG);

        // Config B: Gain = 1 (±1.3 Gauss, 1090 LSB/Gauss = 10.90 LSB/µT)
        _magWriteReg(HMC5883L_ADDR, HMC_REG_CRB, HMC_CRB_GAIN_1_3GA);

        // Mode: Continuous measurement mode
        _magWriteReg(HMC5883L_ADDR, HMC_REG_MODE, HMC_MODE_CONTINUOUS);
        delay(15);

        uint8_t testBuf[6];
        if (_magReadRegs(HMC5883L_ADDR, HMC_REG_OUT_X_MSB, testBuf, 6)) {
            _sensorType = MAG_TYPE_HMC5883L;
            _magAddr    = HMC5883L_ADDR;
            _isHmc      = true;

            Serial.println(F("[MAG] Honeywell HMC5883L detected at 0x1E"));
            Serial.println(F("[MAG] Initialization OK"));
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // 3. Fallback Probe for QMC5883L (Address 0x0D)
    // -------------------------------------------------------------------------
    Serial.println(F("[MAG] Probing 0x0D (QMC5883L alternate)..."));
    Wire.beginTransmission(QMC5883L_ADDR);
    if (Wire.endTransmission() == 0) {
        // Software reset
        _magWriteReg(QMC5883L_ADDR, QMC_REG_CTRL2, 0x80);
        delay(15);

        // FBR set/reset period
        _magWriteReg(QMC5883L_ADDR, QMC_REG_FBR, 0x01);

        // CTRL1: Continuous mode | 200 Hz ODR | 8G range | OSR 512
        _magWriteReg(QMC5883L_ADDR, QMC_REG_CTRL1, 0x1D);
        delay(15);

        uint8_t testBuf[6];
        if (_magReadRegs(QMC5883L_ADDR, QMC_REG_DATA_X_LSB, testBuf, 6)) {
            _sensorType = MAG_TYPE_QMC5883L;
            _magAddr    = QMC5883L_ADDR;
            _isHmc      = false;

            Serial.println(F("[MAG] QMC5883L detected at 0x0D"));
            Serial.println(F("[MAG] Initialization OK"));
            return true;
        }
    }

    _sensorType = MAG_TYPE_NONE;
    Serial.println(F("[MAG] ERROR: No supported magnetometer responded at 0x2C, 0x1E, or 0x0D."));
    return false;
}

bool magRead(MagData &data) {
    if (_sensorType == MAG_TYPE_QMC5883P) {
        // ---------------------------------------------------------------------
        // HP5883 / QMC5883P Read Sequence (Address 0x2C)
        // ---------------------------------------------------------------------
        uint8_t status = 0;
        _magReadRegs(QMC5883P_ADDR, QMC5883P_REG_STATUS, &status, 1);

        uint8_t buf[6];
        // Read 6 bytes starting at register 0x01 (XOUT_LSB)
        if (!_magReadRegs(QMC5883P_ADDR, QMC5883P_REG_XOUT_LSB, buf, 6)) {
            data.valid = false;
            return false;
        }

        // Output order: X_LSB (0x01), X_MSB (0x02), Y_LSB (0x03), Y_MSB (0x04), Z_LSB (0x05), Z_MSB (0x06)
        data.rawX = (int16_t)((buf[1] << 8) | buf[0]);
        data.rawY = (int16_t)((buf[3] << 8) | buf[2]);
        data.rawZ = (int16_t)((buf[5] << 8) | buf[4]);

        // Overflow bit in Status Register (bit 1 = OVL)
        data.overflow = (status & 0x02) != 0;

        // Convert LSB to µT (±8G Range = 3750 LSB/Gauss = 37.50 LSB/µT)
        data.x = (float)data.rawX / QMC5883P_SENSITIVITY_8G;
        data.y = (float)data.rawY / QMC5883P_SENSITIVITY_8G;
        data.z = (float)data.rawZ / QMC5883P_SENSITIVITY_8G;

        data.sensorType = MAG_TYPE_QMC5883P;
        data.isHmc      = false;

    } else if (_sensorType == MAG_TYPE_HMC5883L) {
        // ---------------------------------------------------------------------
        // Honeywell HMC5883L Read Sequence (Address 0x1E)
        // ---------------------------------------------------------------------
        uint8_t buf[6];
        // Read 6 bytes starting from register 0x03 (OUT_X_MSB)
        if (!_magReadRegs(HMC5883L_ADDR, HMC_REG_OUT_X_MSB, buf, 6)) {
            data.valid = false;
            return false;
        }

        // Output order: X_MSB, X_LSB, Z_MSB, Z_LSB, Y_MSB, Y_LSB (Big-Endian, X-Z-Y order!)
        data.rawX = (int16_t)((buf[0] << 8) | buf[1]);
        data.rawZ = (int16_t)((buf[2] << 8) | buf[3]);
        data.rawY = (int16_t)((buf[4] << 8) | buf[5]);

        // Overflow detection on HMC5883L: reading is -4096 when out of range
        data.overflow = (data.rawX == -4096 || data.rawY == -4096 || data.rawZ == -4096);

        // Convert LSB to µT (Gain 1 = 1090 LSB/Gauss = 10.90 LSB/µT)
        data.x = (float)data.rawX / HMC_SENSITIVITY_UT;
        data.y = (float)data.rawY / HMC_SENSITIVITY_UT;
        data.z = (float)data.rawZ / HMC_SENSITIVITY_UT;

        data.sensorType = MAG_TYPE_HMC5883L;
        data.isHmc      = true;

    } else if (_sensorType == MAG_TYPE_QMC5883L) {
        // ---------------------------------------------------------------------
        // Fallback QMC5883L Read Sequence (Address 0x0D)
        // ---------------------------------------------------------------------
        uint8_t status = 0;
        _magReadRegs(QMC5883L_ADDR, QMC_REG_STATUS, &status, 1);

        uint8_t buf[6];
        if (!_magReadRegs(QMC5883L_ADDR, QMC_REG_DATA_X_LSB, buf, 6)) {
            data.valid = false;
            return false;
        }

        // Output order: X_LSB, X_MSB, Y_LSB, Y_MSB, Z_LSB, Z_MSB (Little-Endian, X-Y-Z order)
        data.rawX = (int16_t)((buf[1] << 8) | buf[0]);
        data.rawY = (int16_t)((buf[3] << 8) | buf[2]);
        data.rawZ = (int16_t)((buf[5] << 8) | buf[4]);
        data.overflow = (status & 0x02) != 0;

        data.x = (float)data.rawX / QMC_SENSITIVITY_8G;
        data.y = (float)data.rawY / QMC_SENSITIVITY_8G;
        data.z = (float)data.rawZ / QMC_SENSITIVITY_8G;

        data.sensorType = MAG_TYPE_QMC5883L;
        data.isHmc      = false;

    } else {
        data.valid = false;
        return false;
    }

    // Vector magnitude calculation in µT
    data.magnitude  = sqrtf(data.x * data.x + data.y * data.y + data.z * data.z);

    // Compass heading calculation (degrees 0.0 - 359.9 with declination)
    data.headingDeg = magCalculateHeading(data.x, data.y, MAG_DECLINATION_DEG);
    data.cardinal   = magHeadingToCardinal(data.headingDeg);

    data.valid = true;
    return true;
}

void magApplyCalibration(MagData &data, const MagCalibration &cal) {
    if (!data.valid) return;

    // 1. Hard-iron offset subtraction
    float hx = data.x - cal.offsetX;
    float hy = data.y - cal.offsetY;
    float hz = data.z - cal.offsetZ;

    // 2. Soft-iron 3x3 matrix multiplication
    data.x = cal.matrix[0][0]*hx + cal.matrix[0][1]*hy + cal.matrix[0][2]*hz;
    data.y = cal.matrix[1][0]*hx + cal.matrix[1][1]*hy + cal.matrix[1][2]*hz;
    data.z = cal.matrix[2][0]*hx + cal.matrix[2][1]*hy + cal.matrix[2][2]*hz;

    // 3. Recompute calibrated vector magnitude
    data.magnitude = sqrtf(data.x * data.x + data.y * data.y + data.z * data.z);

    // 4. Recompute Digital Compass Heading
    data.headingDeg = magCalculateHeading(data.x, data.y, MAG_DECLINATION_DEG);
    data.cardinal   = magHeadingToCardinal(data.headingDeg);
}

float magCalculateHeading(float x, float y, float declinationDeg) {
    // 2D horizontal azimuth heading from X and Y axes
    float headingRad = atan2f(y, x);

    // Apply local magnetic declination
    headingRad += (declinationDeg * 0.0174532925f); // deg to rad

    // Normalize to [0, 2*PI)
    if (headingRad < 0.0f) {
        headingRad += 2.0f * 3.14159265f;
    } else if (headingRad >= 2.0f * 3.14159265f) {
        headingRad -= 2.0f * 3.14159265f;
    }

    // Convert to degrees [0.0 to 359.9]
    return headingRad * 57.2957795f;
}

const char* magHeadingToCardinal(float headingDeg) {
    if (headingDeg >= 337.5f || headingDeg < 22.5f)  return "N";
    if (headingDeg >= 22.5f  && headingDeg < 67.5f)  return "NE";
    if (headingDeg >= 67.5f  && headingDeg < 112.5f) return "E";
    if (headingDeg >= 112.5f && headingDeg < 157.5f) return "SE";
    if (headingDeg >= 157.5f && headingDeg < 202.5f) return "S";
    if (headingDeg >= 202.5f && headingDeg < 247.5f) return "SW";
    if (headingDeg >= 247.5f && headingDeg < 292.5f) return "W";
    return "NW";
}

bool magRunCalibration(MagCalibration &cal) {
    Serial.println(F("\n=========================================="));
    Serial.println(F(" MAGNETOMETER & COMPASS CALIBRATION"));
    Serial.println(F(" Rotate the node through ALL 3D orientations"));
    Serial.println(F(" Sampling for 15 seconds..."));
    Serial.println(F("=========================================="));

    float minX = 99999.0f, maxX = -99999.0f;
    float minY = 99999.0f, maxY = -99999.0f;
    float minZ = 99999.0f, maxZ = -99999.0f;

    uint32_t startMs = millis();
    uint32_t sampleCount = 0;

    setLedState(LED_CALIBRATING);

    while (millis() - startMs < 15000) {
        MagData d;
        if (magRead(d)) {
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
            if (d.z < minZ) minZ = d.z;
            if (d.z > maxZ) maxZ = d.z;
            sampleCount++;
        }
        updateLed();
        delay(20); // 50 Hz sampling during calibration
    }

    if (sampleCount < 100) {
        setLedState(LED_READY);
        Serial.println(F("[MAG] CALIBRATION FAILED: Insufficient samples collected."));
        return false;
    }

    setLedState(LED_READY);

    // Hard-iron bias: (max + min) / 2
    cal.offsetX = (maxX + minX) / 2.0f;
    cal.offsetY = (maxY + minY) / 2.0f;
    cal.offsetZ = (maxZ + minZ) / 2.0f;

    // Soft-iron chord lengths: (max - min) / 2
    float deltaX = (maxX - minX) / 2.0f;
    float deltaY = (maxY - minY) / 2.0f;
    float deltaZ = (maxZ - minZ) / 2.0f;
    float avgDelta = (deltaX + deltaY + deltaZ) / 3.0f;

    // Reset soft-iron matrix to normalized diagonal scaling
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            cal.matrix[i][j] = (i == j) ? 1.0f : 0.0f;
        }
    }

    if (deltaX > 0.1f) cal.matrix[0][0] = avgDelta / deltaX;
    if (deltaY > 0.1f) cal.matrix[1][1] = avgDelta / deltaY;
    if (deltaZ > 0.1f) cal.matrix[2][2] = avgDelta / deltaZ;

    cal.valid = true;

    Serial.println(F("[MAG] Calibration Routine Successful."));
    magPrintCalibration(cal);

    if (sdIsAvailable()) {
        sdSaveCalibration(cal);
    }

    return true;
}

void magResetCalibration(MagCalibration &cal) {
    cal.offsetX = 0.0f;
    cal.offsetY = 0.0f;
    cal.offsetZ = 0.0f;
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            cal.matrix[i][j] = (i == j) ? 1.0f : 0.0f;
        }
    }
    cal.valid = false;
    Serial.println(F("[MAG] Calibration reset to identity."));
}

void magPrintCalibration(const MagCalibration &cal) {
    Serial.println(F("\n--- CURRENT MAG CALIBRATION ---"));
    Serial.print(F("Hard-Iron Offsets (uT): X="));
    Serial.print(cal.offsetX, 3);
    Serial.print(F(" Y="));
    Serial.print(cal.offsetY, 3);
    Serial.print(F(" Z="));
    Serial.println(cal.offsetZ, 3);
    Serial.println(F("Soft-Iron Matrix:"));
    for (int i = 0; i < 3; i++) {
        Serial.print(F("  [ "));
        for (int j = 0; j < 3; j++) {
            Serial.print(cal.matrix[i][j], 4);
            Serial.print(F(" "));
        }
        Serial.println(F("]"));
    }
    Serial.print(F("Status: "));
    Serial.println(cal.valid ? F("VALID / LOADED") : F("UNCALIBRATED (identity)"));
    Serial.println(F("-------------------------------\n"));
}

bool magHealthCheck() {
    if (_sensorType == MAG_TYPE_NONE) return false;
    Wire.beginTransmission(_magAddr);
    return (Wire.endTransmission() == 0);
}
