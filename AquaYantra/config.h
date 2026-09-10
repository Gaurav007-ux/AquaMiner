// =============================================================================
// AQUAYANTRA — config.h
// Central configuration for STM32F411CEU6 Black Pill Underwater Sensor Node
// Dual-MCU Architecture: STM32 (Underwater Node) + ESP32 (Surface Node)
// NOTE: GPS is handled exclusively by ESP32. USART1 (PA9/PA10) is reserved
// for inter-MCU communication.
// =============================================================================
#pragma once
#include <Arduino.h>

// =============================================================================
// DEVICE IDENTITY
// =============================================================================
#define DEVICE_ID "AQUAYANTRA-001"
#define FIRMWARE_VERSION "2.1.0-BLACKPILL"

// =============================================================================
// MODE FLAGS
// =============================================================================
#define DEBUG_MODE true
#define SIMULATION_MODE false // false = REAL HARDWARE (production default)

// =============================================================================
// PIN DEFINITIONS — STM32F411CEU6 Black Pill
// =============================================================================
// I2C1 (QMC5883L + BMP280 share this bus, external 4.7k pull-ups to 3.3V
// recommended)
#define PIN_I2C_SDA PB7
#define PIN_I2C_SCL PB6

// SPI1 (MicroSD Module)
#define PIN_SPI_SCK PA5
#define PIN_SPI_MISO PA6
#define PIN_SPI_MOSI PA7
#define PIN_SD_CS PA4

// ADC1 Inputs (WARNING: 3.3V MAX! Sensor outputs > 3.3V will damage STM32 ADC)
#define PIN_TURBIDITY_ADC PA0   // Turbidity sensor analog output
#define PIN_BATTERY_ADC   PB1   // Battery divider: R1=33k, R2=10k (ADC1_IN9)
#define PIN_PH_ADC        PA2   // Analog pH probe signal conditioning board
#define PIN_TDS_ADC       PA3   // Analog TDS probe signal conditioning board

// USART1 (Inter-MCU Communication with ESP32 Surface Controller)
#define PIN_COMM_TX       PA9    // STM32 TX -> ESP32 RX
#define PIN_COMM_RX       PA10   // STM32 RX <- ESP32 TX

// Status LED: PB0 -> 220 Ohm resistor -> LED Anode (+), Cathode (-) -> GND (PB0 HIGH = ON)
#define PIN_STATUS_LED    PB0

// 1-Wire Waterproof Temperature Sensor: DS18B20 (requires 4.7k pull-up between 3.3V and PB9)
#define PIN_DS18B20       PB9

// =============================================================================
// I2C ADDRESSES
// =============================================================================
#define QMC5883P_ADDR     0x2C  // HP5883 / QMC5883P (HW-127 primary magnetometer address)
#define HMC5883L_ADDR     0x1E  // Honeywell HMC5883L primary address
#define QMC5883L_ADDR     0x0D  // QMC5883L auto-fallback address
#define BMP280_ADDR_LOW   0x76  // BMP280 default low address (SDO = GND)
#define BMP280_ADDR_HIGH  0x77  // BMP280 alternate high address (SDO = 3.3V)
#define OLED_I2C_ADDR     0x3C  // SSD1306 0.96-inch 128x64 OLED Display address

// =============================================================================
// OLED DISPLAY CONFIGURATION (SSD1306 128x64 I2C)
// =============================================================================
#define OLED_SCREEN_WIDTH        128
#define OLED_SCREEN_HEIGHT       64
#define OLED_RESET_PIN           -1
#define OLED_REFRESH_INTERVAL_MS 1000 // 1 Hz human-readable update rate
#define OLED_SCREEN_ROTATION_MS  3500 // 3.5 seconds per screen rotation

// =============================================================================
// STARTUP COUNTDOWN CONFIGURATION
// =============================================================================
#define STARTUP_COUNTDOWN_SEC    3   // 3-second quick initialization/stabilization delay

// =============================================================================
// COMPASS & MAGNETOMETER CONFIGURATION
// =============================================================================
// Local magnetic declination in degrees (+ for East, - for West).
#define MAG_DECLINATION_DEG 0.0f

// =============================================================================
// ADC CONFIGURATION & VOLTAGE SAFETY
// =============================================================================
#define ADC_VREF 3.30f         // STM32F411 internal/VDA reference voltage
#define ADC_RESOLUTION 4096.0f // 12-bit ADC (0 - 4095)

// Voltage scaling factors for 5V sensor modules:
// If a sensor module operates at 5V and outputs up to 5V, an external voltage
// divider MUST be fitted before the STM32 ADC pin (e.g. 10k / 20k -> divide
// by 1.5). If an external divider is present, define DIVIDER_RATIO = V_pin /
// V_sensor. Default = 1.0f (assuming 3.3V compliant signal or sensor board
// output <= 3.3V).
#define TURBIDITY_DIVIDER_RATIO 1.0f
#define PH_DIVIDER_RATIO 1.0f
#define TDS_DIVIDER_RATIO 1.0f

// =============================================================================
// BATTERY VOLTAGE DIVIDER (3S Li-ion / LiPo)
// =============================================================================
// Battery(+) — R1 (33k) — Node(PA1) — R2 (10k) — GND
// V_pin = V_bat * (10 / (33 + 10)) = V_bat * 0.232558
// V_bat = V_pin * 4.300
#define BATTERY_R1 33000.0f // 33 kΩ
#define BATTERY_R2 10000.0f // 10 kΩ
#define BATTERY_DIVIDER_RATIO                                                  \
  (BATTERY_R2 / (BATTERY_R1 + BATTERY_R2))                          // 0.232558f
#define BATTERY_MULTIPLIER ((BATTERY_R1 + BATTERY_R2) / BATTERY_R2) // 4.300f

#define BATTERY_FULL_VOLTAGE 12.60f    // 3S Li-ion fully charged (4.20V / cell)
#define BATTERY_NOMINAL_VOLTAGE 11.10f // 3S Li-ion nominal (3.70V / cell)
#define BATTERY_LOW_VOLTAGE 10.50f     // Low warning (3.50V / cell)
#define BATTERY_CRITICAL_VOLTAGE 9.50f // Critical cutoff warning (3.17V / cell)
#define BATTERY_EMPTY_VOLTAGE 9.00f    // Absolute empty cutoff (3.00V / cell)
#define BATTERY_SAMPLES_COUNT 16       // 16x ADC oversampling

// =============================================================================
// WATER QUALITY SENSORS CONFIGURATION
// =============================================================================
// Turbidity
#define TURBIDITY_AVG_SAMPLES 16
#define TURBIDITY_CLEAR_VOLTAGE 2.80f // Typical clear water voltage
#define TURBIDITY_MURKY_VOLTAGE 1.20f // Typical dirty water voltage

// Analog pH Sensor Calibration defaults
#define PH_AVG_SAMPLES 16
#define PH_NEUTRAL_VOLTAGE 1.500f // Nominal voltage for pH 7.00 buffer
#define PH_ACID_VOLTAGE 2.016f    // Nominal voltage for pH 4.01 buffer
#define PH_BASE_VOLTAGE 0.984f    // Nominal voltage for pH 10.01 buffer

// Analog TDS Sensor Configuration
#define TDS_AVG_SAMPLES 16
#define TDS_DEFAULT_FACTOR                                                     \
  0.50f // EC to TDS conversion factor (typically 0.5 - 0.7)

// =============================================================================
// DEPTH ESTIMATION (BMP280 — shallow/prototype context only)
// =============================================================================
#define WATER_DENSITY 1025.0f  // kg/m³ (seawater = 1025, freshwater = 1000)
#define GRAVITY_ACCEL 9.80665f // m/s²

// =============================================================================
// ANOMALY DETECTION & SIGNAL PROCESSING
// =============================================================================
// Sampling rate: 50 Hz = 20 ms
#define MAG_SAMPLE_INTERVAL_MS 20

// Baseline exponential moving average alpha (0.005 = ~4-second smoothing
// window)
#define BASELINE_ADAPTATION_RATE 0.005f

// Anomaly threshold: deviation (µT) above baseline
#define ANOMALY_THRESHOLD_UT 2.0f

// Baseline freeze threshold: freeze EMA if deviation exceeds 75% of threshold
#define BASELINE_FREEZE_UT (ANOMALY_THRESHOLD_UT * 0.75f)

// Rate of Change (derivative) threshold in µT/s
#define ROC_THRESHOLD_UT_S 5.0f

// Minimum consecutive candidate samples at 50 Hz to confirm DETECTED_EVENT (5 =
// 100 ms)
#define ANOMALY_PERSISTENCE_COUNT 5

// Pre-trigger rolling RAM buffer: 5 seconds at 50 Hz = 250 samples
#define PRE_TRIGGER_SAMPLES 250

// Post-trigger recording duration after anomaly returns to normal: 5 seconds
#define POST_TRIGGER_DURATION_MS 5000

// Multi-variable scoring weights
#define WEIGHT_MAG_DEV 0.50f
#define WEIGHT_MAG_ROC 0.30f
#define WEIGHT_WATER_STABILITY 0.20f

// =============================================================================
// TASK SCHEDULING INTERVALS (milliseconds)
// =============================================================================
#define TASK_MAG_INTERVAL 20         // 50 Hz (Magnetometer + Anomaly Engine)
#define TASK_PRESSURE_INTERVAL 200   // 5 Hz
#define TASK_WATER_QUAL_INTERVAL 200 // 5 Hz (pH, TDS, Turbidity)
#define TASK_BATTERY_INTERVAL 500    // 2 Hz
#define TASK_SURVEY_LOG_INTERVAL                                               \
  2000                              // 0.5 Hz (Survey summary to SD every 2 sec)
#define TASK_TELEMETRY_INTERVAL 500 // 2 Hz (Live monitor + JSON Lines output)

// =============================================================================
// SERIAL INTERFACES
// =============================================================================
#define USB_SERIAL_BAUD 115200
#define INTER_MCU_BAUD 115200

// =============================================================================
// SD CARD LOGGING PATHS (FAT 8.3 Compliant)
// Standard Arduino SD library requires directory <= 8 chars & file <= 8 chars!
// =============================================================================
#define SD_ROOT_DIR "/AQUA"
#define SD_SURVEY_DIR "/SURVEY"
#define SD_EVENTS_DIR "/EVENTS"
#define SD_MAG_CAL_FILE "/MAG_CAL.DAT"
#define SD_SENSOR_CAL_FILE "/SNS_CAL.DAT"

#define SD_MAX_SURVEY_LINES                                                    \
  50000 // Rotate survey file after ~27 hours at 2s interval
#define SD_WRITE_BUFFER_SIZE 512
#define SD_FLUSH_INTERVAL_MS 2000
