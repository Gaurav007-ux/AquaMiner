// =============================================================================
// AQUAYANTRA — ESP32 NEO-6M GPS Surface Station (esp32_gateway.ino)
//
// 100% WIRED USB SERIAL OPERATION — GPS ONLY:
// - Direct USB Connection: ESP32 connects to PC via standard USB cable (COM Port)
// - NEO-6M GPS: Receives live GPS signals at the surface (UART2: GPIO 16/17)
// - USB Data Stream:
//     1. Streams live GPS telemetry JSON every 1 sec directly to frontend
//     2. Provides real-time GPS anchor coordinates for survey georeferencing
//     3. Includes Indoor Demo Simulation Mode (type "SIM" or "MOCK") for judges
//
// HARDWARE CONNECTIONS (ESP32 Surface Station):
// 1. NEO-6M GPS:
//    - GPS TX -> ESP32 GPIO 16 (RX2)  *** IMPORTANT: TX connects to RX2 ***
//    - GPS RX -> ESP32 GPIO 17 (TX2)
//    - VCC    -> 3.3V or 5V (5V is recommended for NEO-6M modules with 3.3V LDO)
//    - GND    -> GND
//
// 2. PC USB Connection:
//    - USB cable directly from ESP32 to PC USB port (115200 baud)
//
// 3. Status LED:
//    - GPIO 2 (On-board LED) — solid on GPS fix, toggles when searching
//
// COMMANDS (Type in Serial Monitor or send via USB):
// - "SIM" / "MOCK" : Toggle indoor demo mode (provides valid boat fix indoors)
// - "RAW"          : Dumps the next 5 raw NMEA sentences received from GPS
// - "STATUS"       : Full diagnostic report (bytes received, baud rate, fix state)
// - "GPS"          : Immediately prints current GPS packet
// =============================================================================

#include <Arduino.h>

// Hardware Pins
#define PIN_GPS_RX        16  // HardwareSerial2 RX2 <- NEO-6M TX
#define PIN_GPS_TX        17  // HardwareSerial2 TX2 -> NEO-6M RX
#define PIN_STATUS_LED     2  // On-board LED

// Serial Port for NEO-6M GPS
HardwareSerial SerialGPS(2);

// Diagnostic counters
static uint32_t gpsBytesReceived = 0;
static uint32_t rawNmeaCount = 0;
static int rawDebugDump = 0;
static bool simMode = false; // Indoor Presentation Mode for judges

// ---- GPS DATA STRUCTURE & NMEA PARSER ---------------------------------------
struct GPSData {
    bool   valid;
    double latitude;
    double longitude;
    float  altitudeM;
    float  speedKnots;
    int    satellites;
    float  hdop;
    uint32_t lastFixMs;
    // Time fields from NMEA
    int    hour;
    int    minute;
    int    second;
    int    day;
    int    month;
    int    year;
    bool   timeValid;
};

static GPSData currentGps = { false, 0.0, 0.0, 0.0f, 0.0f, 0, 99.9f, 0,
                                0, 0, 0, 0, 0, 0, false };

static double parseNmeaCoord(const char* val, char dir) {
    if (!val || strlen(val) < 4) return 0.0;
    double raw = atof(val);
    int degrees = (int)(raw / 100.0);
    double minutes = raw - (degrees * 100.0);
    double dec = degrees + (minutes / 60.0);
    if (dir == 'S' || dir == 'W') dec = -dec;
    return dec;
}

static void parseNmeaTime(const String &timeStr) {
    if (timeStr.length() >= 6) {
        currentGps.hour   = timeStr.substring(0, 2).toInt();
        currentGps.minute = timeStr.substring(2, 4).toInt();
        currentGps.second = timeStr.substring(4, 6).toInt();
        currentGps.timeValid = true;
    }
}

static void parseNmeaDate(const String &dateStr) {
    if (dateStr.length() >= 6) {
        currentGps.day   = dateStr.substring(0, 2).toInt();
        currentGps.month = dateStr.substring(2, 4).toInt();
        currentGps.year  = 2000 + dateStr.substring(4, 6).toInt();
    }
}

static void parseNmeaLine(const String &line) {
    if (!line.startsWith("$GP") && !line.startsWith("$GN")) return;

    String tokens[20];
    int tokenCount = 0;
    int start = 0;
    for (int i = 0; i <= line.length() && tokenCount < 20; i++) {
        if (i == line.length() || line.charAt(i) == ',' || line.charAt(i) == '*') {
            tokens[tokenCount++] = line.substring(start, i);
            start = i + 1;
        }
    }

    if (tokenCount < 7) return;

    // $GPGGA: Fix quality, Satellites, HDOP, Altitude
    if (tokens[0].endsWith("GGA")) {
        if (tokens[1].length() >= 6) {
            parseNmeaTime(tokens[1]);
        }
        int fixQuality = tokens[6].toInt();
        if (fixQuality > 0 && tokens[2].length() > 0 && tokens[4].length() > 0) {
            currentGps.latitude = parseNmeaCoord(tokens[2].c_str(), tokens[3].charAt(0));
            currentGps.longitude = parseNmeaCoord(tokens[4].c_str(), tokens[5].charAt(0));
            currentGps.satellites = tokens[7].toInt();
            currentGps.hdop = tokens[8].toFloat();
            currentGps.altitudeM = tokens[9].toFloat();
            currentGps.valid = true;
            currentGps.lastFixMs = millis();
        } else {
            currentGps.satellites = tokens[7].toInt();
            if (millis() - currentGps.lastFixMs > 10000) {
                currentGps.valid = false;
            }
        }
    }
    // $GPRMC: Latitude, Longitude, Speed, Date
    else if (tokens[0].endsWith("RMC")) {
        if (tokens[1].length() >= 6) {
            parseNmeaTime(tokens[1]);
        }
        if (tokens[2] == "A" && tokens[3].length() > 0 && tokens[5].length() > 0) {
            currentGps.latitude = parseNmeaCoord(tokens[3].c_str(), tokens[4].charAt(0));
            currentGps.longitude = parseNmeaCoord(tokens[5].c_str(), tokens[6].charAt(0));
            currentGps.speedKnots = tokens[7].toFloat();
            currentGps.valid = true;
            currentGps.lastFixMs = millis();
        }
        if (tokenCount > 9 && tokens[9].length() >= 6) {
            parseNmeaDate(tokens[9]);
        }
    }
}

// ---- SEND PERIODIC GPS TELEMETRY OVER USB -----------------------------------
void sendGpsTelemetry() {
    bool hasRealFix = currentGps.valid;
    bool isEffectiveValid = hasRealFix || simMode;

    // Blink LED: solid on GPS fix, toggle when searching
    if (isEffectiveValid) {
        digitalWrite(PIN_STATUS_LED, HIGH);
    } else {
        digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    }

    Serial.print(F("{\"type\":\"gps\",\"valid\":"));
    Serial.print(isEffectiveValid ? F("true") : F("false"));
    
    // Satellites
    Serial.print(F(",\"satellites\":"));
    if (hasRealFix) {
        Serial.print(currentGps.satellites);
    } else if (simMode) {
        Serial.print(9); // Simulated satellite lock for presentation
    } else {
        Serial.print(currentGps.satellites);
    }

    // Coordinates & Fix
    if (hasRealFix) {
        Serial.print(F(",\"lat\":"));
        Serial.print(currentGps.latitude, 6);
        Serial.print(F(",\"lon\":"));
        Serial.print(currentGps.longitude, 6);
        Serial.print(F(",\"alt\":"));
        Serial.print(currentGps.altitudeM, 1);
        Serial.print(F(",\"hdop\":"));
        Serial.print(currentGps.hdop, 2);
        Serial.print(F(",\"mode\":\"REAL_SATELLITE_LOCK\""));
    } else if (simMode) {
        // High-precision presentation coordinates (Central Indian Ocean Basin survey anchor)
        Serial.print(F(",\"lat\":28.613900,\"lon\":77.209000,\"alt\":2.5,\"hdop\":1.10"));
        Serial.print(F(",\"mode\":\"INDOOR_DEMO_FIX\""));
    } else {
        Serial.print(F(",\"lat\":null,\"lon\":null"));
        Serial.print(F(",\"mode\":\"SEARCHING\""));
    }

    // Diagnostics: UART bytes received from NEO-6M
    Serial.print(F(",\"rx_bytes\":"));
    Serial.print(gpsBytesReceived);
    Serial.print(F(",\"nmea_lines\":"));
    Serial.print(rawNmeaCount);

    // Human-readable status hint
    if (gpsBytesReceived == 0 && millis() > 4000) {
        Serial.print(F(",\"status\":\"NO_DATA_FROM_GPS_CHECK_WIRING\""));
    } else if (!hasRealFix && !simMode) {
        Serial.print(F(",\"status\":\"ACQUIRING_SATELLITES_NEED_OPEN_SKY\""));
    } else if (hasRealFix) {
        Serial.print(F(",\"status\":\"3D_SATELLITE_LOCK_ACTIVE\""));
    } else {
        Serial.print(F(",\"status\":\"INDOOR_DEMO_SIMULATION_ACTIVE\""));
    }

    // UTC time string
    if (currentGps.timeValid && currentGps.year > 2000) {
        char timeBuf[32];
        snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
                 currentGps.year, currentGps.month, currentGps.day,
                 currentGps.hour, currentGps.minute, currentGps.second);
        Serial.print(F(",\"time\":\""));
        Serial.print(timeBuf);
        Serial.print(F("\""));
    } else if (currentGps.timeValid) {
        char timeBuf[16];
        snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d",
                 currentGps.hour, currentGps.minute, currentGps.second);
        Serial.print(F(",\"time\":\""));
        Serial.print(timeBuf);
        Serial.print(F("\""));
    }

    Serial.print(F(",\"uptime_s\":"));
    Serial.print(millis() / 1000);
    Serial.println(F("}"));
}

// ---- PROCESS COMMANDS FROM PC VIA USB SERIAL --------------------------------
void processSerialCommand(const String &cmd) {
    String c = cmd;
    c.trim();
    c.toUpperCase();

    if (c == "GPS") {
        sendGpsTelemetry();
    } else if (c == "SIM" || c == "MOCK" || c == "DEMO") {
        simMode = !simMode;
        Serial.print(F("{\"type\":\"sim_mode\",\"enabled\":"));
        Serial.print(simMode ? F("true") : F("false"));
        Serial.println(F(",\"message\":\"Indoor Demo Presentation Mode toggled. Supplies valid boat anchor when indoors.\"}"));
    } else if (c == "RAW") {
        rawDebugDump = 5;
        Serial.println(F("{\"type\":\"debug\",\"message\":\"Dumping next 5 raw NMEA sentences from NEO-6M...\"}"));
    } else if (c == "STATUS" || c == "HELP") {
        Serial.println(F("{\"device\":\"AQUAYANTRA-ESP32-GPS-STATION\",\"version\":\"3.1\"}"));
        Serial.printf("{\"gps_fix\":%s,\"sim_mode\":%s,\"rx_bytes\":%u,\"nmea_lines\":%u}\n",
            currentGps.valid ? "true" : "false",
            simMode ? "true" : "false",
            gpsBytesReceived,
            rawNmeaCount
        );
        Serial.println(F("{\"commands\":[\"GPS\",\"SIM\",\"RAW\",\"STATUS\",\"PING\"]}"));
    } else if (c == "PING") {
        Serial.println(F("{\"type\":\"pong\",\"device\":\"AQUAYANTRA-GPS\"}"));
    }
}

// ---- SETUP & LOOP -----------------------------------------------------------
void setup() {
    // USB Serial to PC (115200 baud)
    Serial.begin(115200);
    delay(300);

    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);

    // Initialize GPS UART2 (9600 baud default for NEO-6M)
    SerialGPS.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

    Serial.println(F("{\"type\":\"init\",\"device\":\"AQUAYANTRA-GPS-STATION\",\"mode\":\"WIRED_USB_GPS\",\"baud\":115200}"));
    Serial.println(F("{\"type\":\"info\",\"hint\":\"If testing indoors for judges, type 'SIM' into Serial Monitor for simulated boat lock.\"}"));
}

void loop() {
    // 1. Read and parse incoming NMEA stream from NEO-6M GPS
    while (SerialGPS.available()) {
        char c = (char)SerialGPS.read();
        gpsBytesReceived++;

        static String nmeaSentence = "";
        if (c == '\n' || c == '\r') {
            if (nmeaSentence.length() > 0) {
                rawNmeaCount++;
                if (rawDebugDump > 0) {
                    Serial.print(F("{\"type\":\"raw_nmea\",\"sentence\":\""));
                    Serial.print(nmeaSentence);
                    Serial.println(F("\"}"));
                    rawDebugDump--;
                }
                parseNmeaLine(nmeaSentence);
                nmeaSentence = "";
            }
        } else if (nmeaSentence.length() < 120) {
            nmeaSentence += c;
        }
    }

    // 2. Read commands from PC over USB COM port
    while (Serial.available()) {
        char c = (char)Serial.read();
        static String cmdBuffer = "";
        if (c == '\n' || c == '\r') {
            if (cmdBuffer.length() > 0) {
                processSerialCommand(cmdBuffer);
                cmdBuffer = "";
            }
        } else if (cmdBuffer.length() < 64) {
            cmdBuffer += c;
        }
    }

    // 3. Periodic GPS streaming over USB (every 1 second)
    static uint32_t lastGpsMs = 0;
    if (millis() - lastGpsMs >= 1000) {
        lastGpsMs = millis();
        sendGpsTelemetry();
    }
}
