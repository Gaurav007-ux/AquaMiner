// =============================================================================
// AQUAYANTRA — magnetometer.h
// Multi-device Magnetometer Driver supporting:
//  1. HP5883 / QMC5883P (HW-127 module) at I2C address 0x2C (Primary)
//  2. Honeywell HMC5883L at I2C address 0x1E
//  3. QMC5883L (alternate clone) at I2C address 0x0D
// Includes digital compass heading calculation and hard/soft-iron 3D calibration.
// =============================================================================
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "config.h"

// --- Magnetometer Device Types ---
enum MagType {
    MAG_TYPE_NONE     = 0,
    MAG_TYPE_QMC5883P = 1,  // HP5883 / QMC5883P at 0x2C (HW-127)
    MAG_TYPE_HMC5883L = 2,  // Honeywell HMC5883L at 0x1E
    MAG_TYPE_QMC5883L = 3   // QMC5883L at 0x0D
};

// --- HP5883 / QMC5883P Register Map (Address 0x2C) ---
#define QMC5883P_REG_CHIP_ID     0x00 // Chip ID register (returns 0x80)
#define QMC5883P_REG_XOUT_LSB    0x01 // Data Output X LSB
#define QMC5883P_REG_XOUT_MSB    0x02 // Data Output X MSB
#define QMC5883P_REG_YOUT_LSB    0x03 // Data Output Y LSB
#define QMC5883P_REG_YOUT_MSB    0x04 // Data Output Y MSB
#define QMC5883P_REG_ZOUT_LSB    0x05 // Data Output Z LSB
#define QMC5883P_REG_ZOUT_MSB    0x06 // Data Output Z MSB
#define QMC5883P_REG_STATUS      0x09 // Status: bit0=DRDY, bit1=OVL
#define QMC5883P_REG_CTL1        0x0A // Control 1: Mode (bits 1:0), ODR (bits 3:2), OSR (bits 5:4), DSR (bits 7:6)
#define QMC5883P_REG_CTL2        0x0B // Control 2: Soft Reset (bit 7), Range (bits 3:2), Set/Reset (bits 1:0)
#define QMC5883P_REG_AXIS_CONF   0x29 // Axis sensitivity trim / configuration register

#define QMC5883P_CHIP_ID_VAL     0x80 // Expected hardware Chip ID for QMC5883P

// QMC5883P Control Values
// CTL1 (0x0A): Mode Continuous (0x03) | 200 Hz ODR (0x03 << 2 = 0x0C) | OSR 8 (0x00) | DSR 1 (0x00) = 0x0F
#define QMC5883P_CTL1_200HZ_CONT 0x0F
// CTL1 (0x0A): Mode Continuous (0x03) | 50 Hz ODR  (0x01 << 2 = 0x04) | OSR 8 (0x00) | DSR 1 (0x00) = 0x07
#define QMC5883P_CTL1_50HZ_CONT  0x07
// CTL2 (0x0B): Range ±8G (0x02 << 2 = 0x08) | Set/Reset ON (0x00) = 0x08
#define QMC5883P_CTL2_8G_RANGE   0x08
#define QMC5883P_CTL2_SOFT_RESET 0x80

// Sensitivity: ±8 Gauss range = 3750 LSB/Gauss = 37.50 LSB/µT (1 Gauss = 100 µT)
#define QMC5883P_SENSITIVITY_8G  37.50f

// --- Honeywell HMC5883L Register Map (Address 0x1E) ---
#define HMC_REG_CRA              0x00
#define HMC_REG_CRB              0x01
#define HMC_REG_MODE             0x02
#define HMC_REG_OUT_X_MSB        0x03
#define HMC_REG_OUT_X_LSB        0x04
#define HMC_REG_OUT_Z_MSB        0x05
#define HMC_REG_OUT_Z_LSB        0x06
#define HMC_REG_OUT_Y_MSB        0x07
#define HMC_REG_OUT_Y_LSB        0x08
#define HMC_REG_STATUS           0x09
#define HMC_REG_IDA              0x0A
#define HMC_REG_IDB              0x0B
#define HMC_REG_IDC              0x0C

// HMC Configuration Values
#define HMC_CRA_75HZ_8AVG        0x78 // 8 samples averaged, 75 Hz data rate, normal bias
#define HMC_CRA_15HZ_8AVG        0x70 // 8 samples averaged, 15 Hz data rate, normal bias
#define HMC_CRB_GAIN_1_3GA       0x20 // ±1.3 Gauss range (1090 LSB/Gauss)
#define HMC_MODE_CONTINUOUS      0x00 // Continuous-measurement mode
#define HMC_SENSITIVITY_UT       10.90f // 1090 LSB/Gauss = 10.90 LSB/µT

// --- QMC5883L Register Map (Fallback Address 0x0D) ---
#define QMC_REG_DATA_X_LSB       0x00
#define QMC_REG_STATUS           0x06
#define QMC_REG_CTRL1            0x09
#define QMC_REG_CTRL2            0x0A
#define QMC_REG_FBR              0x0B
#define QMC_SENSITIVITY_8G       30.0f // 3000 LSB/Gauss = 30.0 LSB/µT

struct MagCalibration {
    float offsetX = 0.0f;
    float offsetY = 0.0f;
    float offsetZ = 0.0f;
    float matrix[3][3] = {
        {1.0f, 0.0f, 0.0f},
        {0.0f, 1.0f, 0.0f},
        {0.0f, 0.0f, 1.0f}
    };
    bool valid = false;
};

struct MagData {
    int16_t     rawX = 0, rawY = 0, rawZ = 0;
    float       x = 0.0f, y = 0.0f, z = 0.0f; // Calibrated µT
    float       magnitude  = 0.0f;
    float       headingDeg = 0.0f;           // Compass azimuth (0.0° to 359.9°)
    const char* cardinal   = "N";            // N, NE, E, SE, S, SW, W, NW
    bool        overflow   = false;
    bool        valid      = false;
    MagType     sensorType = MAG_TYPE_NONE;  // Detected sensor type
    bool        isHmc      = false;          // Maintained for backward compatibility
};

bool magInit();
bool magRead(MagData &data);
void magApplyCalibration(MagData &data, const MagCalibration &cal);
bool magRunCalibration(MagCalibration &cal);
void magResetCalibration(MagCalibration &cal);
void magPrintCalibration(const MagCalibration &cal);
bool magHealthCheck();
const char* magGetSensorName();

float       magCalculateHeading(float x, float y, float declinationDeg);
const char* magHeadingToCardinal(float headingDeg);
