#include "communication.h"
#include "oled_display.h"

Uart SerialFTDI(PA10, PA9);

void DualSerialPort::begin(unsigned long baud) {
    Serial.begin(baud);
    SerialFTDI.begin(baud);
}

size_t DualSerialPort::write(uint8_t c) {
    if (Serial) Serial.write(c);
    SerialFTDI.write(c);
    return 1;
}

size_t DualSerialPort::write(const uint8_t *buffer, size_t size) {
    if (Serial) Serial.write(buffer, size);
    SerialFTDI.write(buffer, size);
    return size;
}

void DualSerialPort::flush() {
    Serial.flush();
    SerialFTDI.flush();
}

int DualSerialPort::available() {
    if (SerialFTDI.available()) return SerialFTDI.available();
    return Serial.available();
}

int DualSerialPort::read() {
    if (SerialFTDI.available()) return SerialFTDI.read();
    return Serial.read();
}

DualSerialPort DualSerial;

#define Serial DualSerial

// ---- Help Reference ---------------------------------------------------------

void commPrintHelp() {
    Serial.println(F("\n============================================="));
    Serial.println(F(" AQUAYANTRA FIRMWARE COMMAND REFERENCE"));
    Serial.println(F("============================================="));
    Serial.println(F(" HELP              - Show this command reference"));
    Serial.println(F(" STATUS            - System health and sensor summary"));
    Serial.println(F(" SCAN / I2C        - Scan I2C bus (PB6=SCL, PB7=SDA) for devices"));
    Serial.println(F(" MAG               - Magnetometer vectors & magnitude"));
    Serial.println(F(" COMPASS           - Digital compass heading & azimuth"));
    Serial.println(F(" TEMP              - Water temp (DS18B20) & housing temp"));
    Serial.println(F(" PRESSURE          - Pressure, temperature & depth"));
    Serial.println(F(" TURBIDITY         - Turbidity ADC & voltage"));
    Serial.println(F(" PH                - pH sensor reading & calibration"));
    Serial.println(F(" TDS               - TDS sensor reading & calibration"));
    Serial.println(F(" BATTERY           - Battery voltage & cell state"));
    Serial.println(F(" CALIBRATE         - Run 15s 3D magnetometer calibration"));
    Serial.println(F(" RESET_CALIBRATION - Reset mag calibration to identity"));
    Serial.println(F(" GET_CALIBRATION   - Print mag calibration matrix"));
    Serial.println(F(" CAL_PH_7          - Calibrate pH neutral (7.00 buffer)"));
    Serial.println(F(" CAL_PH_4          - Calibrate pH acid (4.01 buffer)"));
    Serial.println(F(" RESET_PH          - Reset pH to uncalibrated defaults"));
    Serial.println(F(" CAL_TDS <val>     - Calibrate TDS with known ppm value"));
    Serial.println(F(" RESET_TDS         - Reset TDS to uncalibrated defaults"));
    Serial.println(F(" SET_SURFACE       - Capture BMP280 atmospheric baseline"));
    Serial.println(F(" START_LOG         - Resume SD card logging"));
    Serial.println(F(" STOP_LOG          - Pause SD card logging"));
    Serial.println(F(" RESET_BASELINE    - Reset magnetic baseline filter"));
    Serial.println(F(" SD_STATUS         - Show SD card state and files"));
    Serial.println(F("=============================================\n"));
}

// ---- Command Parser ---------------------------------------------------------

void commParseCommand(const String &cmd, SystemState &state) {
    String c = cmd;
    c.trim();

    String arg = "";
    int spaceIdx = c.indexOf(' ');
    if (spaceIdx > 0) {
        arg = c.substring(spaceIdx + 1);
        arg.trim();
        c = c.substring(0, spaceIdx);
    }
    c.toUpperCase();

    if (c == "HELP") {
        commPrintHelp();

    } else if (c == "STATUS") {
        Serial.println(F("\n--- SYSTEM HEALTH & SUBSYSTEM STATUS ---"));
        Serial.print(F("Device ID        : ")); Serial.println(F(DEVICE_ID));
        Serial.print(F("Firmware Version : ")); Serial.println(F(FIRMWARE_VERSION));
        Serial.print(F("Magnetometer     : ")); Serial.print(magGetSensorName()); Serial.print(F(" - ")); Serial.println(healthStateStr(state.health.magnetometer));
        Serial.print(F("BMP280           : ")); Serial.println(healthStateStr(state.health.bmp280));
        Serial.print(F("Water Temp (1-W) : ")); Serial.println(healthStateStr(state.health.waterTemp));
        Serial.print(F("pH Sensor        : ")); Serial.println(healthStateStr(state.health.ph));
        Serial.print(F("TDS Sensor       : ")); Serial.println(healthStateStr(state.health.tds));
        Serial.print(F("Turbidity ADC    : ")); Serial.println(healthStateStr(state.health.turbidity));
        Serial.print(F("Battery          : ")); Serial.println(healthStateStr(state.health.battery));
        Serial.print(F("MicroSD Card     : ")); Serial.println(healthStateStr(state.health.sdCard));
        Serial.print(F("Mag Calibration  : ")); Serial.println(state.cal.valid ? F("LOADED") : F("UNCALIBRATED"));
        Serial.print(F("pH Calibration   : ")); Serial.println(state.ph.calibrated ? F("CALIBRATED") : F("UNCALIBRATED"));
        Serial.print(F("TDS Calibration  : ")); Serial.println(state.tds.calibrated ? F("CALIBRATED") : F("UNCALIBRATED"));
        Serial.print(F("SD Logging State : ")); Serial.println(sdLoggingActive() ? F("ACTIVE") : F("STOPPED"));
        Serial.print(F("Data Quality     : ")); Serial.print(state.dataQuality * 100.0f, 1); Serial.println(F(" %"));
        Serial.println(F("----------------------------------------\n"));

    } else if (c == "MAG") {
        Serial.println(F("\n--- MAGNETOMETER & COMPASS ---"));
        if (state.mag.valid) {
            Serial.print(F("Device Model   : ")); Serial.println(magGetSensorName());
            Serial.print(F("Compass Heading: ")); Serial.print(state.mag.headingDeg, 1); Serial.print(F(" deg ("));
            Serial.print(state.mag.cardinal); Serial.println(F(")"));
            Serial.print(F("X-Axis (cal)   : ")); Serial.print(state.mag.x, 3); Serial.println(F(" uT"));
            Serial.print(F("Y-Axis (cal)   : ")); Serial.print(state.mag.y, 3); Serial.println(F(" uT"));
            Serial.print(F("Z-Axis (cal)   : ")); Serial.print(state.mag.z, 3); Serial.println(F(" uT"));
            Serial.print(F("Total Magnitude: ")); Serial.print(state.mag.magnitude, 3); Serial.println(F(" uT"));
            Serial.print(F("ADC Raw [X,Y,Z]: ["));
            Serial.print(state.mag.rawX); Serial.print(F(", "));
            Serial.print(state.mag.rawY); Serial.print(F(", "));
            Serial.print(state.mag.rawZ); Serial.println(F("]"));
            Serial.print(F("ADC Overflow   : ")); Serial.println(state.mag.overflow ? F("YES") : F("NO"));
        } else {
            Serial.println(F("ERROR: Sensor data not valid or I2C read error."));
        }

    } else if (c == "COMPASS") {
        Serial.println(F("\n--- DIGITAL COMPASS HEADING ---"));
        if (state.mag.valid) {
            Serial.print(F("Heading        : ")); Serial.print(state.mag.headingDeg, 1); Serial.println(F(" deg"));
            Serial.print(F("Direction      : ")); Serial.println(state.mag.cardinal);
            Serial.print(F("Sensor         : ")); Serial.println(magGetSensorName());
            Serial.print(F("Declination    : ")); Serial.print(MAG_DECLINATION_DEG, 1); Serial.println(F(" deg"));
        } else {
            Serial.println(F("ERROR: Compass data not valid."));
        }
        Serial.println(F("-------------------------------\n"));

    } else if (c == "SCAN" || c == "I2C") {
        commScanI2C();

    } else if (c == "PRESSURE") {
        Serial.println(F("\n--- PRESSURE & DEPTH SENSOR ---"));
        if (state.pressure.valid) {
            Serial.print(F("Pressure    : ")); Serial.print(state.pressure.pressureHPa, 2); Serial.println(F(" hPa"));
            Serial.print(F("Temperature : ")); Serial.print(state.pressure.temperatureC, 2); Serial.println(F(" C"));
            Serial.print(F("Est. Depth  : ")); Serial.print(state.pressure.depthM, 3); Serial.println(F(" m"));
            Serial.println(F("Note: BMP280 is a shallow prototype sensor (< 1 m depth)."));
        } else {
            Serial.println(F("ERROR: BMP280 offline or out of bounds."));
        }

    } else if (c == "TEMP") {
        Serial.println(F("\n--- TEMPERATURE READINGS ---"));
        if (state.waterTemp.valid) {
            Serial.print(F("Water Temp (DS18B20): ")); Serial.print(state.waterTemp.temperatureC, 2); Serial.println(F(" C"));
        } else {
            Serial.println(F("Water Temp (DS18B20): OFFLINE / DISCONNECTED"));
        }
        if (state.pressure.valid) {
            Serial.print(F("Housing Temp (BMP280): ")); Serial.print(state.pressure.temperatureC, 2); Serial.println(F(" C"));
        } else {
            Serial.println(F("Housing Temp (BMP280): OFFLINE"));
        }
        Serial.println(F("----------------------------\n"));

    } else if (c == "TURBIDITY") {
        Serial.println(F("\n--- TURBIDITY SENSOR ---"));
        if (state.turbidity.valid) {
            Serial.print(F("Raw ADC count : ")); Serial.println(state.turbidity.rawADC);
            Serial.print(F("Analog Voltage: ")); Serial.print(state.turbidity.voltage, 3); Serial.println(F(" V"));
            Serial.print(F("Estimated NTU : ")); Serial.print(state.turbidity.ntu, 1);
            Serial.println(state.turbidity.calibrated ? F(" NTU") : F(" NTU (UNCALIBRATED)"));
        } else {
            Serial.println(F("ERROR: Turbidity read failure."));
        }

    } else if (c == "PH") {
        Serial.println(F("\n--- PH SENSOR ---"));
        if (state.ph.valid) {
            Serial.print(F("pH Value      : ")); Serial.print(state.ph.pH, 2);
            Serial.println(state.ph.calibrated ? F(" (CALIBRATED)") : F(" (UNCALIBRATED)"));
            Serial.print(F("Analog Voltage: ")); Serial.print(state.ph.voltage, 3); Serial.println(F(" V"));
            Serial.print(F("Raw ADC count : ")); Serial.println(state.ph.rawADC);
            Serial.print(F("Temp Comp     : ")); Serial.print(state.ph.temperatureC, 1); Serial.println(F(" C"));
        } else {
            Serial.println(F("ERROR: pH read failure."));
        }

    } else if (c == "TDS") {
        Serial.println(F("\n--- TDS SENSOR ---"));
        if (state.tds.valid) {
            Serial.print(F("TDS Value     : ")); Serial.print(state.tds.tdsPPM, 1);
            Serial.println(state.tds.calibrated ? F(" ppm (CALIBRATED)") : F(" ppm (UNCALIBRATED)"));
            Serial.print(F("Compensated V : ")); Serial.print(state.tds.compensatedVoltage, 3); Serial.println(F(" V"));
            Serial.print(F("Analog Voltage: ")); Serial.print(state.tds.voltage, 3); Serial.println(F(" V"));
            Serial.print(F("Raw ADC count : ")); Serial.println(state.tds.rawADC);
        } else {
            Serial.println(F("ERROR: TDS read failure."));
        }

    } else if (c == "BATTERY") {
        Serial.println(F("\n--- BATTERY MONITOR ---"));
        if (state.battery.valid) {
            Serial.print(F("Pack Voltage  : ")); Serial.print(state.battery.voltage, 2); Serial.println(F(" V"));
            Serial.print(F("Remaining Pct : ")); Serial.print(state.battery.percent, 1); Serial.println(F(" %"));
            Serial.print(F("Battery State : ")); Serial.println(batteryStateStr(state.battery.state));
        } else {
            Serial.println(F("ERROR: Battery read failure."));
        }

    } else if (c == "CALIBRATE") {
        magRunCalibration(state.cal);

    } else if (c == "RESET_CALIBRATION") {
        magResetCalibration(state.cal);

    } else if (c == "GET_CALIBRATION") {
        magPrintCalibration(state.cal);

    } else if (c == "CAL_PH_7") {
        if (phCalibrateNeutral()) {
            if (sdIsAvailable()) sdSaveSensorCalibration(phGetCalibration(), tdsGetCalibration());
        }

    } else if (c == "CAL_PH_4") {
        if (phCalibrateAcid()) {
            if (sdIsAvailable()) sdSaveSensorCalibration(phGetCalibration(), tdsGetCalibration());
        }

    } else if (c == "RESET_PH") {
        phResetCalibration();
        if (sdIsAvailable()) sdSaveSensorCalibration(phGetCalibration(), tdsGetCalibration());

    } else if (c == "CAL_TDS") {
        if (arg.length() > 0) {
            float knownVal = arg.toFloat();
            if (tdsCalibrate(knownVal, state.pressure.temperatureC)) {
                if (sdIsAvailable()) sdSaveSensorCalibration(phGetCalibration(), tdsGetCalibration());
            }
        } else {
            Serial.println(F("[TDS] Usage: CAL_TDS <known_ppm_value> (e.g. CAL_TDS 1413)"));
        }

    } else if (c == "RESET_TDS") {
        tdsResetCalibration();
        if (sdIsAvailable()) sdSaveSensorCalibration(phGetCalibration(), tdsGetCalibration());

    } else if (c == "SET_SURFACE") {
        pressureSetSurface(state.surfacePressure);

    } else if (c == "START_LOG") {
        sdStartLogging();

    } else if (c == "STOP_LOG") {
        sdStopLogging();

    } else if (c == "RESET_BASELINE") {
        processingResetBaseline(state.tracker, state.anomaly);

    } else if (c == "SD_STATUS") {
        Serial.println(F("\n--- MICROSD STORAGE STATUS ---"));
        Serial.print(F("Card Present & Online : ")); Serial.println(sdIsAvailable() ? F("YES") : F("NO"));
        Serial.print(F("Logging Active        : ")); Serial.println(sdLoggingActive() ? F("YES") : F("NO"));
        Serial.print(F("Active Survey File    : ")); Serial.println(sdGetCurrentSurveyFile());
        Serial.print(F("Active Event File     : "));
        if (sdIsEventFileOpen()) {
            Serial.println(sdGetCurrentEventFile());
        } else {
            Serial.println(F("NONE (idle)"));
        }
        Serial.println(F("------------------------------\n"));

    } else {
        Serial.print(F("[CMD] Unknown command: '"));
        Serial.print(cmd);
        Serial.println(F("'. Type HELP for available commands."));
    }
}

// ---- Human-Readable Terminal UI ---------------------------------------------

void commPrintHumanReadable(const SystemState &state, uint32_t sequence) {
    Serial.println(F("--------------------------------"));
    Serial.println(F("AQUAYANTRA LIVE DATA"));
    Serial.println(F("--------------------------------"));

    // Magnetometer & Compass
    Serial.println(F("\nMAGNETOMETER & COMPASS"));
    if (state.mag.valid) {
        Serial.print(F("Heading  : ")); Serial.print(state.mag.headingDeg, 1);
        Serial.print(F(" deg (")); Serial.print(state.mag.cardinal); Serial.println(F(")"));
        Serial.print(F("X        : ")); Serial.print(state.mag.x, 2); Serial.println(F(" uT"));
        Serial.print(F("Y        : ")); Serial.print(state.mag.y, 2); Serial.println(F(" uT"));
        Serial.print(F("Z        : ")); Serial.print(state.mag.z, 2); Serial.println(F(" uT"));
        Serial.print(F("Magnitude: ")); Serial.print(state.mag.magnitude, 2); Serial.println(F(" uT"));
    } else {
        Serial.println(F("ERROR — no valid data"));
    }

    // Baseline
    Serial.println(F("\nBASELINE"));
    Serial.print(F("         : ")); Serial.print(state.tracker.value, 2); Serial.println(F(" uT"));

    // Deviation
    Serial.println(F("\nDEVIATION"));
    Serial.print(F("         : "));
    if (state.tracker.deviation >= 0.0f) Serial.print('+');
    Serial.print(state.tracker.deviation, 2);
    Serial.println(F(" uT"));

    // Rate of Change
    Serial.println(F("\nRATE OF CHANGE"));
    Serial.print(F("         : ")); Serial.print(state.tracker.rateOfChange, 2); Serial.println(F(" uT/s"));

    // Anomaly Status
    Serial.println(F("\nANOMALY STATUS"));
    Serial.print(F("         : ")); Serial.println(processingStateStr(state.anomaly.state));

    // Pressure & Temperature
    Serial.println(F("\nPRESSURE"));
    if (state.pressure.valid) {
        Serial.print(F("         : ")); Serial.print(state.pressure.pressureHPa, 2); Serial.println(F(" hPa"));
        Serial.println(F("\nDEPTH (prototype est.)"));
        Serial.print(F("         : ")); Serial.print(state.pressure.depthM, 2); Serial.println(F(" m"));
    } else {
        Serial.println(F("ERROR — BMP280 unavailable"));
    }

    Serial.println(F("\nTEMPERATURE"));
    if (state.waterTemp.valid) {
        Serial.print(F("Water (DS18B20): ")); Serial.print(state.waterTemp.temperatureC, 2); Serial.println(F(" C"));
    } else {
        Serial.println(F("Water (DS18B20): OFFLINE (falling back to BMP280)"));
    }
    if (state.pressure.valid) {
        Serial.print(F("Housing (BMP280): ")); Serial.print(state.pressure.temperatureC, 1); Serial.println(F(" C"));
    }

    // Water Quality
    Serial.println(F("\nWATER QUALITY"));
    Serial.print(F("Turbidity: "));
    Serial.print(state.turbidity.voltage, 3);
    Serial.print(F(" V"));
    if (!state.turbidity.calibrated) Serial.print(F(" (UNCALIBRATED)"));
    Serial.println();

    Serial.print(F("pH       : "));
    Serial.print(state.ph.pH, 2);
    if (!state.ph.calibrated) Serial.print(F(" (UNCALIBRATED)"));
    Serial.println();

    Serial.print(F("TDS      : "));
    Serial.print(state.tds.tdsPPM, 1);
    Serial.print(F(" ppm"));
    if (!state.tds.calibrated) Serial.print(F(" (UNCALIBRATED)"));
    Serial.println();

    // Battery
    Serial.println(F("\nBATTERY"));
    if (state.battery.valid) {
        Serial.print(F("         : ")); Serial.print(state.battery.voltage, 2); Serial.println(F(" V"));
        Serial.print(F("         : ")); Serial.print(state.battery.percent, 0); Serial.println(F(" %"));
        Serial.print(F("         : ")); Serial.println(batteryStateStr(state.battery.state));
    } else {
        Serial.println(F("ERROR — read failed"));
    }

    // Data Quality
    Serial.println(F("\nDATA QUALITY"));
    Serial.print(F("         : ")); Serial.print(state.dataQuality * 100.0f, 1); Serial.println(F(" %"));

    // SD Card
    Serial.println(F("\nSD CARD"));
    if (sdLoggingActive()) {
        Serial.print(F("         : RECORDING (Survey: "));
        Serial.print(sdGetCurrentSurveyFile());
        Serial.println(F(")"));
    } else {
        Serial.println(F("         : STOPPED"));
    }

    Serial.print(F("\nSeq#: ")); Serial.println(sequence);
    Serial.println(F("--------------------------------\n"));
}

// ---- JSON Lines Telemetry Streaming -----------------------------------------

void commPrintJSON(const SystemState &state, uint32_t sequence) {
    Serial.print(F("{\"device_id\":\""));
    Serial.print(F(DEVICE_ID));
    Serial.print(F("\",\"sequence\":"));
    Serial.print(sequence);
    Serial.print(F(",\"timestamp_ms\":"));
    Serial.print(millis());

    // Magnetometer & Compass
    Serial.print(F(",\"mag_x\":"));
    Serial.print(state.mag.valid ? state.mag.x : 0.0f, 4);
    Serial.print(F(",\"mag_y\":"));
    Serial.print(state.mag.valid ? state.mag.y : 0.0f, 4);
    Serial.print(F(",\"mag_z\":"));
    Serial.print(state.mag.valid ? state.mag.z : 0.0f, 4);
    Serial.print(F(",\"magnitude\":"));
    Serial.print(state.mag.valid ? state.mag.magnitude : 0.0f, 4);
    Serial.print(F(",\"heading_deg\":"));
    Serial.print(state.mag.valid ? state.mag.headingDeg : 0.0f, 1);
    Serial.print(F(",\"cardinal\":\""));
    Serial.print(state.mag.valid ? state.mag.cardinal : "N");
    Serial.print(F("\""));

    // Baseline & Anomaly
    Serial.print(F(",\"baseline\":"));
    Serial.print(state.tracker.value, 4);
    Serial.print(F(",\"deviation\":"));
    Serial.print(state.tracker.deviation, 4);
    Serial.print(F(",\"roc\":"));
    Serial.print(state.tracker.rateOfChange, 4);
    Serial.print(F(",\"anomaly_state\":\""));
    Serial.print(processingStateStr(state.anomaly.state));
    Serial.print(F("\",\"anomaly_score\":"));
    Serial.print(state.anomaly.anomalyScore, 4);

    // Pressure & Environmental
    Serial.print(F(",\"pressure_hpa\":"));
    Serial.print(state.pressure.valid ? state.pressure.pressureHPa : 0.0f, 2);
    Serial.print(F(",\"temperature_c\":"));
    Serial.print(state.waterTemp.valid ? state.waterTemp.temperatureC : (state.pressure.valid ? state.pressure.temperatureC : 25.0f), 2);
    Serial.print(F(",\"bmp280_temp_c\":"));
    Serial.print(state.pressure.valid ? state.pressure.temperatureC : 0.0f, 2);
    Serial.print(F(",\"depth_m\":"));
    Serial.print(state.pressure.valid ? state.pressure.depthM : 0.0f, 3);

    // Water Quality
    Serial.print(F(",\"turbidity_v\":"));
    Serial.print(state.turbidity.valid ? state.turbidity.voltage : 0.0f, 4);
    Serial.print(F(",\"turbidity_ntu\":"));
    Serial.print(state.turbidity.valid ? state.turbidity.ntu : 0.0f, 1);
    Serial.print(F(",\"ph\":"));
    Serial.print(state.ph.valid ? state.ph.pH : 7.0f, 2);
    Serial.print(F(",\"tds_ppm\":"));
    Serial.print(state.tds.valid ? state.tds.tdsPPM : 0.0f, 1);

    // Battery
    Serial.print(F(",\"battery_v\":"));
    Serial.print(state.battery.valid ? state.battery.voltage : 0.0f, 3);
    Serial.print(F(",\"battery_pct\":"));
    Serial.print(state.battery.valid ? state.battery.percent : 0.0f, 1);

    // Health
    Serial.print(F(",\"data_quality\":"));
    Serial.print(state.dataQuality, 3);
    Serial.println(F("}"));
}

// ---- Boot Banner ------------------------------------------------------------

void commPrintBootBanner(const SystemHealth &h, const BatteryData &bat,
                         const MagCalibration &cal, const PhCalibration &phCal,
                         const TdsCalibration &tdsCal) {
    Serial.println(F("\n============================================="));
    Serial.println(F(" AQUAYANTRA UNDERWATER NODE (STM32F411CEU6)"));
    Serial.println(F("============================================="));
    Serial.print(F(" Device ID        : ")); Serial.println(F(DEVICE_ID));
    Serial.print(F(" Firmware         : ")); Serial.println(F(FIRMWARE_VERSION));
    Serial.println(F("---------------------------------------------"));
    Serial.println(F(" Subsystem Status:"));
    Serial.print(F("   Magnetometer   : "));
    if (h.magnetometer == HEALTH_HEALTHY) {
        Serial.print(magGetSensorName());
        Serial.println(F(" [ONLINE]"));
    } else {
        Serial.println(F("ERROR"));
    }
    Serial.print(F("   BMP280 Baro    : ")); Serial.println(h.bmp280 == HEALTH_HEALTHY ? F("ONLINE") : F("ERROR"));
    Serial.print(F("   Water Temp     : ")); Serial.println(h.waterTemp == HEALTH_HEALTHY ? F("ONLINE (PB9)") : F("OFFLINE"));
    Serial.print(F("   Turbidity ADC  : ")); Serial.println(F("ONLINE (PA0)"));
    Serial.print(F("   pH Sensor ADC  : ")); Serial.println(F("ONLINE (PA2)"));
    Serial.print(F("   TDS Sensor ADC : ")); Serial.println(F("ONLINE (PA3)"));
    Serial.print(F("   MicroSD SPI1   : ")); Serial.println(h.sdCard == HEALTH_HEALTHY ? F("ONLINE") : F("OFFLINE/ERROR"));
    Serial.print(F("   OLED Display   : ")); Serial.println(oledIsAvailable() ? F("ONLINE (0x3C)") : F("OFFLINE / NONE"));
    Serial.print(F("   Battery Mon    : "));
    if (bat.valid) {
        Serial.print(bat.voltage, 2); Serial.print(F(" V ("));
        Serial.print(bat.percent, 0); Serial.println(F("%)"));
    } else {
        Serial.println(F("ERROR"));
    }
    Serial.println(F("---------------------------------------------"));
    Serial.println(F(" Calibrations:"));
    Serial.print(F("   Magnetometer   : ")); Serial.println(cal.valid ? F("LOADED") : F("UNCALIBRATED (identity)"));
    Serial.print(F("   pH Probe       : ")); Serial.println(phCal.calibrated ? F("CALIBRATED") : F("UNCALIBRATED"));
    Serial.print(F("   TDS Probe      : ")); Serial.println(tdsCal.calibrated ? F("CALIBRATED") : F("UNCALIBRATED"));
    Serial.println(F("---------------------------------------------"));
    Serial.println(F(" System Status    : READY"));
    Serial.println(F(" Dual-MCU Note    : GPS handled by surface ESP32"));
    Serial.println(F("=============================================\n"));
}

void commScanI2C() {
    Serial.println(F("\n========================="));
    Serial.println(F("AQUAYANTRA I2C SCAN"));
    Serial.println(F("========================="));
    uint8_t count = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        uint8_t error = Wire.endTransmission();
        if (error == 0) {
            Serial.print(F("Found device at 0x"));
            if (addr < 16) Serial.print(F("0"));
            Serial.print(addr, HEX);
            if (addr == 0x2C)      Serial.print(F(" -> HP5883 / QMC5883P Magnetometer (HW-127)"));
            else if (addr == 0x1E) Serial.print(F(" -> Honeywell HMC5883L Magnetometer"));
            else if (addr == 0x0D) Serial.print(F(" -> QMC5883L Magnetometer (clone/alternate)"));
            else if (addr == 0x3C) Serial.print(F(" -> SSD1306 0.96\" OLED Display (128x64)"));
            else if (addr == 0x76) Serial.print(F(" -> BMP280 Pressure/Temp (SDO=GND)"));
            else if (addr == 0x77) Serial.print(F(" -> BMP280 Pressure/Temp (SDO=3.3V)"));
            Serial.println();
            count++;
        }
    }
    if (count == 0) {
        Serial.println(F("NO I2C DEVICES FOUND!"));
        Serial.println(F("Diagnostic checks:"));
        Serial.println(F(" 1. Pin Wiring: Check that 'B6' is connected to SCL and 'B7' is connected to SDA."));
        Serial.println(F("    Try SWAPPING SCL and SDA if unsure!"));
        Serial.println(F(" 2. Power: Confirm 3.3V and GND are securely connected to the sensor boards."));
        Serial.println(F(" 3. Pull-ups: Check that 4.7k pull-up resistors are connected to 3.3V on SDA & SCL."));
        Serial.println(F(" 4. BMP280 CSB pin: If your BMP280 module has a CSB pin, it MUST be tied to 3.3V!"));
    } else {
        Serial.print(F("Total I2C devices acknowledged: "));
        Serial.println(count);
    }
    Serial.println(F("------------------------------------------------\n"));
}
