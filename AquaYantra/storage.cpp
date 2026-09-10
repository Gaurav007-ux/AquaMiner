// =============================================================================
// AQUAYANTRA — storage.cpp
// MicroSD storage implementation for dual survey and event recording
// Standard FAT 8.3 root directory architecture for 100% reliable logging.
// Robust SPI initialization, auto-recovery reconnect, and dual serial feedback.
// =============================================================================
#include "storage.h"
#include "communication.h"

static bool     _sdAvailable           = false;
static bool     _loggingActive         = true;
static char     _currentSurveyFile[24] = "";
static char     _currentEventFile[24]  = "";
static File     _eventFileHandle;
static uint32_t _surveyFileIndex       = 1;
static uint32_t _eventFileIndex        = 1;
static uint32_t _surveyLineCount       = 0;
static uint8_t  _consecutiveErrors     = 0;
static uint32_t _lastInitAttemptMs     = 0;

static const char SURVEY_CSV_HEADER[] =
    "timestamp_ms,sequence,depth_m,mag_mean,mag_min,mag_max,mag_std,"
    "temperature_c,ph,tds_ppm,turbidity_ntu,battery_v";

static const char EVENT_CSV_HEADER[] =
    "timestamp_ms,sequence,mag_x_raw,mag_y_raw,mag_z_raw,mag_magnitude,"
    "mag_baseline,mag_deviation,mag_rate,noise,anomaly_score,pressure_hpa,"
    "temperature_c,depth_m,ph,tds_ppm,turbidity_ntu,battery_v,data_quality";

static bool rotateSurveyFile() {
    // Find next available 8.3 sequential file in root: SURV_001.CSV ... SURV_999.CSV
    for (uint32_t i = _surveyFileIndex; i < 999; i++) {
        snprintf(_currentSurveyFile, sizeof(_currentSurveyFile), "SURV_%03lu.CSV", (unsigned long)i);
        if (!SD.exists(_currentSurveyFile)) {
            _surveyFileIndex = i;
            break;
        }
    }

    // Create file and write CSV header
    File f = SD.open(_currentSurveyFile, FILE_WRITE);
    if (f) {
        f.println(SURVEY_CSV_HEADER);
        f.flush();
        f.close();
        _surveyLineCount   = 0;
        _consecutiveErrors = 0;
        DualSerial.print(F("[SD] Initialized active survey file: "));
        DualSerial.println(_currentSurveyFile);
        return true;
    } else {
        DualSerial.print(F("[SD] ERROR: Failed to create survey file: "));
        DualSerial.println(_currentSurveyFile);
        return false;
    }
}

bool sdInit() {
    _lastInitAttemptMs = millis();

    // 1. Configure Hardware SPI1 pins on STM32 Black Pill
    pinMode(PIN_SD_CS, OUTPUT);
    digitalWrite(PIN_SD_CS, HIGH);

    SPI.setMOSI(PIN_SPI_MOSI); // PA7
    SPI.setMISO(PIN_SPI_MISO); // PA6
    SPI.setSCLK(PIN_SPI_SCK);  // PA5
    SPI.begin();
    delay(20);

    // 2. Initialize SD library on chip select PA4 (Sd2Card automatically handles SPI handshake)
    if (!SD.begin(PIN_SD_CS)) {
        delay(50);
        if (!SD.begin(PIN_SD_CS)) {
            _sdAvailable = false;
            DualSerial.println(F("[SD] MicroSD initialization failed. Please check:"));
            DualSerial.println(F("     - Card inserted & formatted FAT32 (<= 32GB)"));
            DualSerial.println(F("     - Wiring: CS=PA4, SCK=PA5, MISO=PA6, MOSI=PA7"));
            DualSerial.println(F("     - Power: Connect 5V to 5V (if module has regulator) or 3.3V"));
            return false;
        }
    }

    _sdAvailable       = true;
    _loggingActive     = true;
    _consecutiveErrors = 0;

    // 3. Establish active survey file
    if (!rotateSurveyFile()) {
        DualSerial.println(F("[SD] Warning: Could not create initial survey file."));
    }

    DualSerial.println(F("[SD] MicroSD Card mounted successfully (FAT32 Root)."));
    DualSerial.print(F("[SD] Active Survey file: "));
    DualSerial.println(_currentSurveyFile);

    return true;
}

bool sdIsAvailable() {
    return _sdAvailable;
}

bool sdLoggingActive() {
    return _sdAvailable && _loggingActive;
}

void sdStartLogging() {
    if (_sdAvailable) {
        _loggingActive = true;
        DualSerial.println(F("[SD] Logging enabled."));
    } else {
        if (sdInit()) {
            _loggingActive = true;
            DualSerial.println(F("[SD] Card initialized & logging started."));
        } else {
            DualSerial.println(F("[SD] Cannot start logging: card offline."));
        }
    }
}

void sdStopLogging() {
    _loggingActive = false;
    if (_eventFileHandle) {
        _eventFileHandle.flush();
        _eventFileHandle.close();
    }
    DualSerial.println(F("[SD] Logging paused."));
}

const char* sdGetCurrentSurveyFile() {
    return _currentSurveyFile;
}

const char* sdGetCurrentEventFile() {
    return _currentEventFile;
}

bool sdWriteSurveyRecord(const SurveyRecord &r) {
    // Non-blocking auto-reconnect if card was offline
    if (!_sdAvailable) {
        if (millis() - _lastInitAttemptMs >= 3000UL) {
            if (!sdInit()) return false;
        } else {
            return false;
        }
    }

    if (!_loggingActive) return false;

    // Ensure we have a valid filename
    if (_currentSurveyFile[0] == '\0') {
        if (!rotateSurveyFile()) return false;
    }

    // Check line count limit for rotation (~50,000 lines)
    if (_surveyLineCount >= SD_MAX_SURVEY_LINES) {
        _surveyFileIndex++;
        rotateSurveyFile();
    }

    File f = SD.open(_currentSurveyFile, FILE_WRITE);
    if (!f) {
        _consecutiveErrors++;
        DualSerial.print(F("[SD] Write open failed for: "));
        DualSerial.println(_currentSurveyFile);

        // Attempt re-creating file
        if (_consecutiveErrors >= 2) {
            rotateSurveyFile();
            f = SD.open(_currentSurveyFile, FILE_WRITE);
        }

        if (!f) {
            if (_consecutiveErrors >= 5) {
                _sdAvailable = false; // Mark offline to trigger clean re-init in 3 sec
                DualSerial.println(F("[SD] Card communication lost. Will attempt auto-recovery."));
            }
            return false;
        }
    }

    _consecutiveErrors = 0;
    _sdAvailable       = true;

    // Write CSV data fields
    f.print(r.timestamp_ms);      f.print(',');
    f.print(r.sequence);          f.print(',');
    f.print(r.depth_m, 2);        f.print(',');
    f.print(r.mag_mean, 1);       f.print(',');
    f.print(r.mag_min, 1);        f.print(',');
    f.print(r.mag_max, 1);        f.print(',');
    f.print(r.mag_std, 2);        f.print(',');
    f.print(r.temperature_c, 2);  f.print(',');
    f.print(r.ph, 2);             f.print(',');
    f.print(r.tds_ppm, 1);        f.print(',');
    f.print(r.turbidity_ntu, 1);  f.print(',');
    f.println(r.battery_v, 2);

    f.flush(); // Ensure data is safely committed to flash sectors
    f.close();

    _surveyLineCount++;

    // Print confirmation to Serial so user immediately sees live writes
    if (_surveyLineCount % 5 == 1) {
        DualSerial.print(F("[SD] Saved Survey #"));
        DualSerial.print(_surveyLineCount);
        DualSerial.print(F(" -> "));
        DualSerial.println(_currentSurveyFile);
    }

    return true;
}

bool sdOpenNextEventFile(uint32_t eventId) {
    if (!_sdAvailable) {
        if (!sdInit()) return false;
    }

    if (_eventFileHandle) {
        _eventFileHandle.flush();
        _eventFileHandle.close();
    }

    // Find next sequential event file name: EVNT_001.CSV ... EVNT_999.CSV
    for (uint32_t i = _eventFileIndex; i < 999; i++) {
        snprintf(_currentEventFile, sizeof(_currentEventFile), "EVNT_%03lu.CSV", (unsigned long)i);
        if (!SD.exists(_currentEventFile)) {
            _eventFileIndex = i;
            break;
        }
    }

    _eventFileHandle = SD.open(_currentEventFile, FILE_WRITE);
    if (!_eventFileHandle) {
        _consecutiveErrors++;
        DualSerial.print(F("[SD] ERROR: Cannot create event file: "));
        DualSerial.println(_currentEventFile);
        return false;
    }

    _eventFileHandle.println(EVENT_CSV_HEADER);
    _eventFileHandle.flush();

    DualSerial.print(F("[SD] OPENED HIGH-RATE EVENT FILE: "));
    DualSerial.println(_currentEventFile);

    return true;
}

bool sdWriteEventSample(const EventSample &s) {
    if (!_sdAvailable || !_eventFileHandle) return false;

    _eventFileHandle.print(s.timestamp_ms);      _eventFileHandle.print(',');
    _eventFileHandle.print(s.sequence);          _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_x_raw);         _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_y_raw);         _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_z_raw);         _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_magnitude, 2);  _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_baseline, 2);   _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_deviation, 2);  _eventFileHandle.print(',');
    _eventFileHandle.print(s.mag_rate, 2);       _eventFileHandle.print(',');
    _eventFileHandle.print(s.noise, 2);          _eventFileHandle.print(',');
    _eventFileHandle.print(s.anomaly_score, 2);  _eventFileHandle.print(',');
    _eventFileHandle.print(s.pressure_hpa, 2);   _eventFileHandle.print(',');
    _eventFileHandle.print(s.temperature_c, 2);  _eventFileHandle.print(',');
    _eventFileHandle.print(s.depth_m, 2);        _eventFileHandle.print(',');
    _eventFileHandle.print(s.ph, 2);             _eventFileHandle.print(',');
    _eventFileHandle.print(s.tds_ppm, 1);        _eventFileHandle.print(',');
    _eventFileHandle.print(s.turbidity_ntu, 1);  _eventFileHandle.print(',');
    _eventFileHandle.print(s.battery_v, 2);      _eventFileHandle.print(',');
    _eventFileHandle.println(s.data_quality, 2);

    return true;
}

void sdCloseEventFile() {
    if (_eventFileHandle) {
        _eventFileHandle.flush();
        _eventFileHandle.close();
        DualSerial.print(F("[SD] CLOSED EVENT FILE: "));
        DualSerial.println(_currentEventFile);
    }
}

bool sdIsEventFileOpen() {
    return (bool)_eventFileHandle;
}

bool sdSaveCalibration(const MagCalibration &cal) {
    if (!_sdAvailable) return false;
    File f = SD.open(SD_MAG_CAL_FILE, FILE_WRITE);
    if (!f) return false;
    f.write((const uint8_t*)&cal, sizeof(MagCalibration));
    f.flush();
    f.close();
    DualSerial.println(F("[SD] Magnetometer calibration saved to SD."));
    return true;
}

bool sdLoadCalibration(MagCalibration &cal) {
    if (!_sdAvailable) return false;
    if (!SD.exists(SD_MAG_CAL_FILE)) return false;
    File f = SD.open(SD_MAG_CAL_FILE, FILE_READ);
    if (!f) return false;
    size_t bytesRead = f.read((uint8_t*)&cal, sizeof(MagCalibration));
    f.close();
    return (bytesRead == sizeof(MagCalibration) && cal.valid);
}

bool sdSaveSensorCalibration(const PhCalibration &phCal, const TdsCalibration &tdsCal) {
    if (!_sdAvailable) return false;
    File f = SD.open(SD_SENSOR_CAL_FILE, FILE_WRITE);
    if (!f) return false;
    f.write((const uint8_t*)&phCal, sizeof(PhCalibration));
    f.write((const uint8_t*)&tdsCal, sizeof(TdsCalibration));
    f.flush();
    f.close();
    DualSerial.println(F("[SD] pH & TDS calibrations saved to SD."));
    return true;
}

bool sdLoadSensorCalibration(PhCalibration &phCal, TdsCalibration &tdsCal) {
    if (!_sdAvailable) return false;
    if (!SD.exists(SD_SENSOR_CAL_FILE)) return false;
    File f = SD.open(SD_SENSOR_CAL_FILE, FILE_READ);
    if (!f) return false;
    size_t b1 = f.read((uint8_t*)&phCal, sizeof(PhCalibration));
    size_t b2 = f.read((uint8_t*)&tdsCal, sizeof(TdsCalibration));
    f.close();
    return (b1 == sizeof(PhCalibration) && b2 == sizeof(TdsCalibration));
}
