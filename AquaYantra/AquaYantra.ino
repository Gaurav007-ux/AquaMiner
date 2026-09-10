// =============================================================================
//  AQUAYANTRA — AquaYantra.ino
//  STM32F411CEU6 Black Pill | Arduino IDE + STM32 Arduino Core
//
//  Underwater Sensor Node Firmware
//  Dual-MCU Architecture:
//    1. STM32F411CEU6 Black Pill:
//       - 50 Hz real-time sensor acquisition & calibration
//       - Baseline tracking & 3-state anomaly detection (NORMAL/CANDIDATE/EVENT)
//       - 5-second circular RAM pre-trigger buffer (250 samples @ 50 Hz)
//       - MicroSD dual-logging (low-rate surveys + high-rate event records)
//       - Multi-sensor payload: QMC5883P/HW-127, BMP280, Turbidity, pH, TDS, Battery
//       - 0.96-inch SSD1306 OLED multi-screen human-readable interface
//    2. ESP32 Surface Controller:
//       - Surface communication, GPS, Wi-Fi / telemetry gateway
//       - Inter-MCU connection via STM32 USART1 (PA9/PA10)
//
//  Hardware Pinout (STM32F411CEU6):
//    I2C1:  SDA = PB7, SCL = PB6       (QMC5883P + BMP280 + SSD1306 OLED)
//    SPI1:  SCK = PA5, MISO = PA6, MOSI = PA7, CS = PA4 (MicroSD)
//    ADC1:  PA0 = Turbidity Analog In  (0-3.3V)
//           PB1 = Battery Divider In   (33k/10k -> 0-2.93V for 3S)
//           PA2 = pH Sensor Analog In  (0-3.3V)
//           PA3 = TDS Sensor Analog In (0-3.3V)
//    USART: TX = PA9, RX = PA10        (Reserved for ESP32 surface controller)
//    LED:   PB0                        (Active HIGH external status LED via 220R)
// =============================================================================

#include <Wire.h>
#include <SPI.h>

#include "config.h"
#include "status_led.h"
#include "oled_display.h"
#include "magnetometer.h"
#include "pressure.h"
#include "water_temp.h"
#include "turbidity.h"
#include "ph_sensor.h"
#include "tds_sensor.h"
#include "battery.h"
#include "processing.h"
#include "storage.h"
#include "event_logger.h"
#include "health.h"
#include "communication.h"

#if !defined(USBD_USE_CDC)
#warning "USB CDC is NOT enabled! In Arduino IDE, go to Tools -> USB support (if available) -> 'CDC (generic Serial supersede U(S)ART)'"
#endif

// =============================================================================
// Global System & Sensor State
// =============================================================================
MagData         g_mag;
MagCalibration  g_cal;
BaselineTracker g_tracker;
AnomalyEngine   g_anomaly;
PressureData    g_pressure;
WaterTempData   g_waterTemp;
TurbidityData   g_turbidity;
PhData          g_ph;
TdsData         g_tds;
BatteryData     g_battery;
SystemHealth    g_health;
float           g_surfacePressure = 1013.25f;
float           g_dataQuality     = 0.0f;
uint32_t        g_sequence        = 0;

// Survey statistical accumulators over the 2-second survey logging interval
static float    g_magSum          = 0.0f;
static float    g_magSumSq        = 0.0f;
static float    g_magMin          = 999999.0f;
static float    g_magMax          = -999999.0f;
static uint32_t g_magSampleCount   = 0;

// =============================================================================
// Task Scheduler Timestamps (Non-blocking millis)
// =============================================================================
static uint32_t t_magLast         = 0;
static uint32_t t_pressureLast    = 0;
static uint32_t t_waterQualLast   = 0;
static uint32_t t_batteryLast     = 0;
static uint32_t t_surveyLogLast   = 0;
static uint32_t t_telemetryLast   = 0;
static uint32_t t_oledLast        = 0;

// Serial command receive buffer
static String g_cmdBuffer = "";

// =============================================================================
// setup() — System Initialization & Self-Test
// =============================================================================
void setup() {
    // 1. Initialize Status LED controller immediately (PB0 active HIGH)
    ledInit();
    ledIndicateStartup(); // 100 ms ON -> 100 ms OFF repeated 3 times

    // 2. Initialize Dual Serial (USB CDC + Hardware UART1 on PA9/PA10 for FTDI)
    DualSerial.begin(USB_SERIAL_BAUD);

    DualSerial.println(F("\n============================================="));
    DualSerial.println(F(" AQUAYANTRA UNDERWATER NODE INITIALIZING..."));
    DualSerial.println(F("============================================="));

    // 3. Hardware I2C1 Bus Recovery & Initialization (PB6=SCL, PB7=SDA)
    DualSerial.println(F("[I2C] SDA = PB7"));
    DualSerial.println(F("[I2C] SCL = PB6"));

    pinMode(PIN_I2C_SDA, INPUT_PULLUP);
    pinMode(PIN_I2C_SCL, INPUT_PULLUP);
    delayMicroseconds(20);

    // If SDA is held LOW by a slave stuck mid-transaction, pulse SCL up to 9 times to free it
    if (digitalRead(PIN_I2C_SDA) == LOW) {
        DualSerial.println(F("[I2C] Bus hung detected (SDA LOW). Clearing bus..."));
        pinMode(PIN_I2C_SCL, OUTPUT);
        for (int i = 0; i < 9 && (digitalRead(PIN_I2C_SDA) == LOW); i++) {
            digitalWrite(PIN_I2C_SCL, LOW);
            delayMicroseconds(10);
            digitalWrite(PIN_I2C_SCL, HIGH);
            delayMicroseconds(10);
        }
        // Generate I2C STOP condition to fully reset bus state
        pinMode(PIN_I2C_SDA, OUTPUT);
        digitalWrite(PIN_I2C_SDA, LOW);
        delayMicroseconds(10);
        digitalWrite(PIN_I2C_SCL, HIGH);
        delayMicroseconds(10);
        digitalWrite(PIN_I2C_SDA, HIGH);
        delayMicroseconds(10);
        pinMode(PIN_I2C_SDA, INPUT_PULLUP);
        pinMode(PIN_I2C_SCL, INPUT_PULLUP);
    }

    // Initialize Hardware I2C1 at 100 kHz Standard Mode (reliable with jumper wires)
    Wire.setSDA(PIN_I2C_SDA);
    Wire.setSCL(PIN_I2C_SCL);
    Wire.begin();
    Wire.setClock(100000);
    delay(50);

    // Automated I2C diagnostic scan (reports detected addresses to Serial Monitor)
    commScanI2C();

    // 4. Initialize 0.96-inch OLED Display immediately (SSD1306 @ 0x3C)
    if (oledInit()) {
        oledShowSplash();
    }

    // 5. Configure ADC Resolution (12-bit on STM32F411 -> 0 to 4095 counts)
    analogReadResolution(12);

    // 6. Initialize Sensor Subsystems
    // 6a. Magnetometer & Digital Compass (QMC5883P / HMC5883L / QMC5883L)
    if (magInit()) {
        g_health.magnetometer = HEALTH_HEALTHY;
    } else {
        g_health.magnetometer = HEALTH_FAULT;
        DualSerial.println(F("[BOOT] WARNING: Magnetometer failed init (check I2C wiring PB6/PB7)."));
    }

    // 6b. BMP280 Barometric Pressure & Temperature
    uint8_t bmpAddr = 0;
    if (pressureInit(bmpAddr)) {
        g_health.bmp280 = HEALTH_HEALTHY;
    } else {
        g_health.bmp280 = HEALTH_FAULT;
        DualSerial.println(F("[BOOT] WARNING: BMP280 sensor failed init."));
    }

    // 6c. DS18B20 1-Wire Waterproof Temperature Sensor (PB9)
    if (waterTempInit()) {
        g_health.waterTemp = HEALTH_HEALTHY;
    } else {
        g_health.waterTemp = HEALTH_OFFLINE;
        DualSerial.println(F("[BOOT] WARNING: DS18B20 water temp probe not found on PB9."));
    }

    // 6d. Turbidity Sensor (PA0)
    turbidityInit();
    g_health.turbidity = HEALTH_HEALTHY;

    // 6e. Analog pH Sensor (PA2)
    phInit();
    g_health.ph = HEALTH_HEALTHY;

    // 6f. Analog TDS Sensor (PA3)
    tdsInit();
    g_health.tds = HEALTH_HEALTHY;

    // 6g. Battery Voltage Monitor (PB1)
    batteryInit();
    batteryRead(g_battery);
    g_health.battery = (g_battery.state == BATTERY_CRITICAL) ? HEALTH_FAULT : HEALTH_HEALTHY;

    // 6h. Initialize MicroSD Card Logging Subsystem
    if (sdInit()) {
        g_health.sdCard = HEALTH_HEALTHY;

        // Load calibrations if present on SD
        if (sdLoadCalibration(g_cal)) {
            g_health.calibLoaded = true;
        }
        PhCalibration phCal;
        TdsCalibration tdsCal;
        if (sdLoadSensorCalibration(phCal, tdsCal)) {
            phSetCalibration(phCal);
            tdsSetCalibration(tdsCal);
        }
    } else {
        g_health.sdCard = HEALTH_OFFLINE;
        DualSerial.println(F("[BOOT] WARNING: MicroSD card not present or init failed."));
    }

    // 7. Initialize Circular Pre-Trigger RAM Buffer & Signal Processing
    eventLoggerInit();
    processingInit(g_tracker, g_anomaly);

    // =========================================================================
    // 8. RAPID SENSOR STABILIZATION (Warm up baseline tracker for 500 ms)
    // =========================================================================
    DualSerial.println(F("[BOOT] Stabilizing baseline & acquiring initial readings..."));
    for (int i = 0; i < 25; i++) {
        MagData rawMag;
        if (magRead(rawMag)) {
            g_mag = rawMag;
            magApplyCalibration(g_mag, g_cal);
            processingUpdate(g_tracker, g_anomaly, g_mag.magnitude, millis());
        }
        delay(20);
    }

    // 9. Initial sensor reads to populate environmental state
    pressureRead(g_pressure);
    waterTempRead(g_waterTemp);
    float initCompTemp = g_waterTemp.valid ? g_waterTemp.temperatureC : g_pressure.temperatureC;
    turbidityRead(g_turbidity);
    phRead(g_ph, initCompTemp);
    tdsRead(g_tds, initCompTemp);
    batteryRead(g_battery);

    // Evaluate initial data quality
    g_dataQuality = calculateDataQuality(g_health);

    // Display Boot Banner and Command Reference
    commPrintBootBanner(g_health, g_battery, g_cal, phGetCalibration(), tdsGetCalibration());
    commPrintHelp();

    // Set Initial System Status LED State
    if (!sdIsAvailable()) {
        setLedState(LED_SD_ERROR);
    } else if (g_health.magnetometer == HEALTH_FAULT || g_health.bmp280 == HEALTH_FAULT) {
        setLedState(LED_SENSOR_ERROR);
    } else {
        setLedState(LED_READY); // Continuously ON: SYSTEM READY / MONITORING
    }

    // 10. Render initial live measurement screen on OLED immediately
    OledData od;
    od.magRawX      = g_mag.rawX;
    od.magRawY      = g_mag.rawY;
    od.magRawZ      = g_mag.rawZ;
    od.magField     = g_mag.magnitude;
    od.headingDeg   = g_mag.headingDeg;
    od.cardinal     = g_mag.cardinal;

    od.depthM       = g_pressure.valid ? g_pressure.depthM : NAN;
    od.pressureHPa  = g_pressure.valid ? g_pressure.pressureHPa : NAN;
    od.tempC        = g_waterTemp.valid ? g_waterTemp.temperatureC : (g_pressure.valid ? g_pressure.temperatureC : NAN);
    od.ph           = g_ph.valid ? g_ph.pH : NAN;
    od.tdsPPM       = g_tds.valid ? g_tds.tdsPPM : NAN;
    od.turbidityNTU = g_turbidity.valid ? g_turbidity.ntu : NAN;

    od.batteryV     = g_battery.valid ? g_battery.voltage : 0.0f;
    od.batteryPct   = g_battery.valid ? g_battery.percent : 0.0f;
    od.sdLogging    = (sdIsAvailable() && sdLoggingActive());
    od.sdOk         = sdIsAvailable();
    od.sensorsOk    = (g_health.magnetometer == HEALTH_HEALTHY && g_health.bmp280 == HEALTH_HEALTHY);

    oledUpdate(od);
    t_oledLast = millis();

    // 11. Start Normal Survey Logging
    sdStartLogging();
    DualSerial.println(F("[BOOT] Live measurement mode active. Normal survey logging started."));
}

// =============================================================================
// loop() — Real-Time Non-Blocking Cooperative Scheduler
// =============================================================================
void loop() {
    // Non-blocking status LED and 1-Wire temperature FSM updates
    updateLed();
    waterTempUpdate();

    uint32_t now = millis();

    // Auto-detect when connection opens and display boot banner
    static bool greetingDone = false;
    if (!greetingDone && (DualSerial.available() || Serial)) {
        greetingDone = true;
        delay(50);
        commPrintBootBanner(g_health, g_battery, g_cal, phGetCalibration(), tdsGetCalibration());
        commPrintHelp();
    }

    // =========================================================================
    // Serial Command Interface (Dual-port consumption: FTDI UART + USB CDC)
    // =========================================================================
    while (DualSerial.available()) {
        char c = (char)DualSerial.read();
        if (c == '\n' || c == '\r') {
            if (g_cmdBuffer.length() > 0) {
                DualSerial.print(F("> "));
                DualSerial.println(g_cmdBuffer);

                SystemState state = {
                    g_mag, g_cal, g_tracker, g_anomaly,
                    g_pressure, g_waterTemp, g_turbidity, g_ph, g_tds,
                    g_battery, g_health, g_surfacePressure, g_dataQuality
                };
                commParseCommand(g_cmdBuffer, state);
                g_cmdBuffer = "";
            }
        } else {
            if (g_cmdBuffer.length() < 64) {
                g_cmdBuffer += c;
            }
        }
    }

    // =========================================================================
    // TASK 1: Magnetometer Acquisition & Anomaly Engine (50 Hz = 20 ms)
    // =========================================================================
    if (now - t_magLast >= TASK_MAG_INTERVAL) {
        t_magLast = now;

#if SIMULATION_MODE
        float t = (float)now / 1000.0f;
        g_mag.x = 12.0f + sinf(t * 0.3f);
        g_mag.y = -5.0f + cosf(t * 0.2f);
        g_mag.z = 40.0f + sinf(t * 0.7f) * 0.5f;
        g_mag.magnitude = sqrtf(g_mag.x*g_mag.x + g_mag.y*g_mag.y + g_mag.z*g_mag.z);
        g_mag.valid = true;
#else
        MagData rawMag;
        if (magRead(rawMag)) {
            g_mag = rawMag;
            magApplyCalibration(g_mag, g_cal);
            g_health.magnetometer = g_mag.overflow ? HEALTH_WARNING : HEALTH_HEALTHY;
        } else {
            g_mag.valid = false;
            g_health.magnetometer = HEALTH_FAULT;
        }
#endif

        if (g_mag.valid) {
            // Update baseline tracker and 3-state anomaly state machine
            processingUpdate(g_tracker, g_anomaly, g_mag.magnitude, now);

            // Accumulate statistics for the low-rate survey log (mag_mean, min, max, std)
            g_magSum += g_mag.magnitude;
            g_magSumSq += (g_mag.magnitude * g_mag.magnitude);
            if (g_mag.magnitude < g_magMin) g_magMin = g_mag.magnitude;
            if (g_mag.magnitude > g_magMax) g_magMax = g_mag.magnitude;
            g_magSampleCount++;

            // Assemble high-rate ring buffer sample for ML-ready EVENT CSV
            RingSample rs;
            rs.timestamp_ms   = now;
            rs.sequence       = g_sequence;
            rs.mag_x_raw      = g_mag.rawX;
            rs.mag_y_raw      = g_mag.rawY;
            rs.mag_z_raw      = g_mag.rawZ;
            rs.mag_magnitude  = g_mag.magnitude;
            rs.mag_baseline   = g_tracker.value;
            rs.mag_deviation  = g_tracker.deviation;
            rs.mag_rate       = g_tracker.rateOfChange;
            rs.noise          = g_tracker.noiseFloor;
            rs.anomaly_score  = g_anomaly.anomalyScore;
            float activeCompTemp = g_waterTemp.valid ? g_waterTemp.temperatureC : g_pressure.temperatureC;
            rs.pressure_hpa   = g_pressure.pressureHPa;
            rs.temperature_c  = activeCompTemp;
            rs.depth_m        = g_pressure.depthM;
            rs.ph             = g_ph.pH;
            rs.tds_ppm        = g_tds.tdsPPM;
            rs.turbidity_ntu  = g_turbidity.ntu;
            rs.battery_v      = g_battery.voltage;
            rs.data_quality   = g_dataQuality;

            // Push to 5-second circular RAM buffer
            eventLoggerPushSample(rs);

            // Manage event logging (pre-trigger dump, 50 Hz active, 5s post-trigger)
            eventLoggerProcess(g_anomaly, rs);
        }

        // Centralized Status LED State Controller
        if (getLedState() != LED_CALIBRATING) {
            if (g_anomaly.state == STATE_DETECTED_EVENT) {
                setLedState(LED_EVENT);
            } else if (g_anomaly.state == STATE_ANOMALY_CANDIDATE) {
                setLedState(LED_ANOMALY_CANDIDATE);
            } else if (!sdIsAvailable()) {
                setLedState(LED_SD_ERROR);
            } else if (g_health.magnetometer == HEALTH_FAULT || g_health.bmp280 == HEALTH_FAULT) {
                setLedState(LED_SENSOR_ERROR);
            } else {
                setLedState(LED_READY);
            }
        }
    }

    // =========================================================================
    // TASK 2: Barometric Pressure, Temperature, and Depth (5 Hz = 200 ms)
    // =========================================================================
    if (now - t_pressureLast >= TASK_PRESSURE_INTERVAL) {
        t_pressureLast = now;

#if SIMULATION_MODE
        g_pressure.pressureHPa  = 1013.25f + sinf((float)now / 5000.0f) * 0.5f;
        g_pressure.temperatureC = 24.5f;
        g_pressure.depthM       = 0.05f;
        g_pressure.valid        = true;
#else
        if (pressureRead(g_pressure)) {
            g_health.bmp280 = HEALTH_HEALTHY;
        } else {
            g_health.bmp280 = HEALTH_FAULT;
        }
#endif
    }

    // =========================================================================
    // TASK 3: Water Quality Sensors — pH, TDS, Turbidity (5 Hz = 200 ms)
    // =========================================================================
    if (now - t_waterQualLast >= TASK_WATER_QUAL_INTERVAL) {
        t_waterQualLast = now;

        waterTempRead(g_waterTemp);
        g_health.waterTemp = waterTempHealthCheck() ? HEALTH_HEALTHY : HEALTH_OFFLINE;
        float compTemp = g_waterTemp.valid ? g_waterTemp.temperatureC : g_pressure.temperatureC;

#if SIMULATION_MODE
        g_turbidity.rawADC  = 2048;
        g_turbidity.voltage = 1.65f;
        g_turbidity.ntu     = 15.0f;
        g_turbidity.valid   = true;

        g_ph.rawADC         = 1860;
        g_ph.voltage        = 1.50f;
        g_ph.pH             = 7.05f;
        g_ph.valid          = true;

        g_tds.rawADC        = 850;
        g_tds.voltage       = 0.68f;
        g_tds.tdsPPM        = 145.0f;
        g_tds.valid         = true;
#else
        turbidityRead(g_turbidity);
        g_health.turbidity = turbidityHealthCheck() ? HEALTH_HEALTHY : HEALTH_WARNING;

        phRead(g_ph, compTemp);
        g_health.ph = phHealthCheck() ? HEALTH_HEALTHY : HEALTH_WARNING;

        tdsRead(g_tds, compTemp);
        g_health.tds = tdsHealthCheck() ? HEALTH_HEALTHY : HEALTH_WARNING;
#endif
    }

    // =========================================================================
    // TASK 4: Battery Voltage Monitoring (2 Hz = 500 ms)
    // =========================================================================
    if (now - t_batteryLast >= TASK_BATTERY_INTERVAL) {
        t_batteryLast = now;

#if SIMULATION_MODE
        g_battery.voltage = 11.90f;
        g_battery.percent = 85.0f;
        g_battery.state   = BATTERY_OK;
        g_battery.valid   = true;
#else
        if (batteryRead(g_battery)) {
            if (g_battery.state == BATTERY_CRITICAL) {
                g_health.battery = HEALTH_FAULT;
            } else if (g_battery.state == BATTERY_LOW) {
                g_health.battery = HEALTH_WARNING;
            } else {
                g_health.battery = HEALTH_HEALTHY;
            }
        } else {
            g_health.battery = HEALTH_WARNING;
        }
#endif
    }

    // =========================================================================
    // TASK 5: Background Survey Summary Logging (0.5 Hz = 2000 ms)
    // =========================================================================
    if (now - t_surveyLogLast >= TASK_SURVEY_LOG_INTERVAL) {
        t_surveyLogLast = now;

        float meanMag = (g_magSampleCount > 0) ? (g_magSum / g_magSampleCount) : g_mag.magnitude;
        float variance = (g_magSampleCount > 1) ? ((g_magSumSq / g_magSampleCount) - (meanMag * meanMag)) : 0.0f;
        float stdMag = sqrtf(variance > 0.0f ? variance : 0.0f);
        float minMag = (g_magSampleCount > 0) ? g_magMin : g_mag.magnitude;
        float maxMag = (g_magSampleCount > 0) ? g_magMax : g_mag.magnitude;

        SurveyRecord sr;
        sr.timestamp_ms = now;
        sr.sequence     = g_sequence;
        sr.depth_m      = g_pressure.valid ? g_pressure.depthM : 0.0f;
        sr.mag_mean     = meanMag;
        sr.mag_min      = minMag;
        sr.mag_max      = maxMag;
        sr.mag_std      = stdMag;
        sr.temperature_c= g_waterTemp.valid ? g_waterTemp.temperatureC : g_pressure.temperatureC;
        sr.ph           = g_ph.pH;
        sr.tds_ppm      = g_tds.tdsPPM;
        sr.turbidity_ntu= g_turbidity.ntu;
        sr.battery_v    = g_battery.voltage;

        // sdWriteSurveyRecord will automatically write to SD or attempt recovery if card offline
        if (sdWriteSurveyRecord(sr)) {
            g_health.sdCard = HEALTH_HEALTHY;
        } else {
            g_health.sdCard = HEALTH_OFFLINE;
        }

        // Reset statistical accumulators for next interval
        g_magSum = 0.0f;
        g_magSumSq = 0.0f;
        g_magMin = 999999.0f;
        g_magMax = -999999.0f;
        g_magSampleCount = 0;
    }

    // =========================================================================
    // TASK 6: Telemetry & Live Monitor Output (2 Hz = 500 ms)
    // =========================================================================
    if (now - t_telemetryLast >= TASK_TELEMETRY_INTERVAL) {
        t_telemetryLast = now;
        g_sequence++;

        // Update overall data quality score
        g_health.calibLoaded = g_cal.valid;
        g_health.sdCard      = sdIsAvailable() ? HEALTH_HEALTHY : HEALTH_OFFLINE;
        g_dataQuality        = calculateDataQuality(g_health);

        SystemState state = {
            g_mag, g_cal, g_tracker, g_anomaly,
            g_pressure, g_waterTemp, g_turbidity, g_ph, g_tds,
            g_battery, g_health, g_surfacePressure, g_dataQuality
        };

        commPrintHumanReadable(state, g_sequence);
        commPrintJSON(state, g_sequence);
        Serial.flush();
    }

    // =========================================================================
    // TASK 7: 0.96-inch OLED Measurement Display Update (1 Hz = 1000 ms)
    // =========================================================================
    if (now - t_oledLast >= OLED_REFRESH_INTERVAL_MS) {
        t_oledLast = now;

        OledData od;
        od.magRawX      = g_mag.rawX;
        od.magRawY      = g_mag.rawY;
        od.magRawZ      = g_mag.rawZ;
        od.magField     = g_mag.magnitude;
        od.headingDeg   = g_mag.headingDeg;
        od.cardinal     = g_mag.cardinal;

        od.depthM       = g_pressure.valid ? g_pressure.depthM : NAN;
        od.pressureHPa  = g_pressure.valid ? g_pressure.pressureHPa : NAN;
        od.tempC        = g_waterTemp.valid ? g_waterTemp.temperatureC : (g_pressure.valid ? g_pressure.temperatureC : NAN);
        od.ph           = g_ph.valid ? g_ph.pH : NAN;
        od.tdsPPM       = g_tds.valid ? g_tds.tdsPPM : NAN;
        od.turbidityNTU = g_turbidity.valid ? g_turbidity.ntu : NAN;

        od.batteryV     = g_battery.valid ? g_battery.voltage : 0.0f;
        od.batteryPct   = g_battery.valid ? g_battery.percent : 0.0f;
        od.sdLogging    = (sdIsAvailable() && sdLoggingActive());
        od.sdOk         = sdIsAvailable();
        od.sensorsOk    = (g_health.magnetometer == HEALTH_HEALTHY && g_health.bmp280 == HEALTH_HEALTHY);

        oledUpdate(od);
    }
}
