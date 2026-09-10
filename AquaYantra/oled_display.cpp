// =============================================================================
// AQUAYANTRA — oled_display.cpp
// 0.96-inch SSD1306 128x64 OLED Measurement Display
// Dedicated exclusively to displaying clear, stable, real-time sensor values.
// =============================================================================
#include "oled_display.h"
#include <math.h>

static Adafruit_SSD1306 _display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);
static bool             _oledAvailable  = false;
static OledScreen       _currentScreen  = SCREEN_SYSTEM;
static uint32_t         _lastRotationMs = 0;

static void drawHeader(const char* title) {
    _display.clearDisplay();
    _display.setTextSize(1);
    _display.setTextColor(SSD1306_WHITE);

    int16_t x1, y1;
    uint16_t w, h;
    _display.getTextBounds(title, 0, 0, &x1, &y1, &w, &h);
    int16_t cursorX = (OLED_SCREEN_WIDTH - (int16_t)w) / 2;
    if (cursorX < 0) cursorX = 0;

    _display.setCursor(cursorX, 1);
    _display.print(title);
    _display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
}

bool oledInit() {
    if (!_display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
        _oledAvailable = false;
        Serial.println(F("[OLED] Warning: SSD1306 OLED not detected at 0x3C. Continuing headless."));
        return false;
    }

    _oledAvailable  = true;
    _currentScreen  = SCREEN_SYSTEM;
    _lastRotationMs = millis();

    _display.clearDisplay();
    _display.display();

    Serial.println(F("[OLED] SSD1306 128x64 OLED initialized successfully at 0x3C."));
    return true;
}

bool oledIsAvailable() {
    return _oledAvailable;
}

void oledShowSplash() {
    if (!_oledAvailable) return;

    drawHeader("AQUAYANTRA");

    _display.setTextSize(1);
    _display.setCursor(18, 18);
    _display.print(F("Underwater Node"));

    _display.setCursor(14, 34);
    _display.print(F("Initializing..."));

    _display.setCursor(8, 48);
    _display.print(F("Sensors & MicroSD"));

    _display.display();
}

void oledShowStartupCountdown(uint8_t secondsRemaining) {
    if (!_oledAvailable) return;

    drawHeader("AQUAYANTRA");

    _display.setCursor(22, 16);
    _display.setTextSize(1);
    _display.print(F("INITIALIZING"));

    _display.setCursor(24, 30);
    _display.print(F("Starting in:"));

    _display.setTextSize(2);
    char buf[12];
    snprintf(buf, sizeof(buf), "%2u sec", secondsRemaining);
    int16_t x1, y1;
    uint16_t w, h;
    _display.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
    int16_t cx = (OLED_SCREEN_WIDTH - (int16_t)w) / 2;
    _display.setCursor(cx > 0 ? cx : 20, 44);
    _display.print(buf);

    _display.display();
}

void oledShowSystemReady(bool sdOk, bool sensorsOk, bool baselineOk) {
    if (!_oledAvailable) return;

    drawHeader("AQUAYANTRA");

    _display.setTextSize(1);
    _display.setCursor(24, 16);
    _display.print(F("SYSTEM READY"));

    _display.setCursor(8, 32);
    _display.print(F("SD: "));
    _display.print(sdOk ? F("OK    ") : F("ERROR "));

    _display.print(F("SNS: "));
    _display.println(sensorsOk ? F("OK") : F("WARN"));

    _display.setCursor(8, 46);
    _display.print(F("Baseline: "));
    _display.println(baselineOk ? F("READY") : F("STABILIZING"));

    _display.display();
}

// ---- Clean Sensor Measurement Screens (No Anomaly Popups) -------------------

// SCREEN 1: System Overview (Depth, Temp, Battery, SD Logging State)
static void renderSystemScreen(const OledData &d) {
    drawHeader("AQUAYANTRA");

    _display.setCursor(4, 15);
    _display.print(F("Depth:   "));
    if (!isnan(d.depthM) && d.depthM >= 0.0f && d.depthM < 100.0f) {
        _display.print(d.depthM, 2);
        _display.println(F(" m"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 27);
    _display.print(F("Temp:    "));
    if (!isnan(d.tempC) && d.tempC > -40.0f && d.tempC < 85.0f) {
        _display.print(d.tempC, 1);
        _display.println(F(" C"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 39);
    _display.print(F("Battery: "));
    if (d.batteryV > 0.0f) {
        _display.print(d.batteryV, 1);
        _display.println(F(" V"));
    } else {
        _display.println(F("FAULT"));
    }

    _display.setCursor(4, 51);
    _display.print(F("SD:      "));
    if (d.sdLogging) {
        _display.println(F("LOGGING"));
    } else if (d.sdOk) {
        _display.println(F("READY"));
    } else {
        _display.println(F("NO CARD"));
    }
}

// SCREEN 2: Magnetic Field (X, Y, Z, Magnitude, Compass Azimuth)
static void renderMagneticScreen(const OledData &d) {
    drawHeader("MAGNETIC FIELD");

    _display.setCursor(4, 14);
    _display.print(F("X: "));
    _display.print(d.magRawX);
    _display.setCursor(68, 14);
    _display.print(F("Y: "));
    _display.print(d.magRawY);

    _display.setCursor(4, 26);
    _display.print(F("Z: "));
    _display.print(d.magRawZ);

    _display.setCursor(4, 38);
    _display.print(F("Field: "));
    _display.print(d.magField, 1);
    _display.println(F(" uT"));

    _display.setCursor(4, 50);
    _display.print(F("Hdg:   "));
    _display.print(d.headingDeg, 0);
    _display.print(F(" deg ("));
    _display.print(d.cardinal ? d.cardinal : "N");
    _display.println(F(")"));
}

// SCREEN 3: Water Quality (pH, TDS, Turbidity, Water Temp)
static void renderWaterQualityScreen(const OledData &d) {
    drawHeader("WATER QUALITY");

    _display.setCursor(4, 15);
    _display.print(F("pH:   "));
    if (!isnan(d.ph) && d.ph >= 0.0f && d.ph <= 14.0f) {
        _display.println(d.ph, 2);
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 27);
    _display.print(F("TDS:  "));
    if (!isnan(d.tdsPPM) && d.tdsPPM >= 0.0f) {
        _display.print((int)roundf(d.tdsPPM));
        _display.println(F(" ppm"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 39);
    _display.print(F("Turb: "));
    if (!isnan(d.turbidityNTU) && d.turbidityNTU >= 0.0f) {
        _display.print((int)roundf(d.turbidityNTU));
        _display.println(F(" NTU"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 51);
    _display.print(F("Temp: "));
    if (!isnan(d.tempC) && d.tempC > -40.0f && d.tempC < 85.0f) {
        _display.print(d.tempC, 1);
        _display.println(F(" C"));
    } else {
        _display.println(F("--"));
    }
}

// SCREEN 4: Pressure & Depth Context
static void renderPressureDepthScreen(const OledData &d) {
    drawHeader("PRESSURE / DEPTH");

    _display.setCursor(4, 15);
    _display.print(F("Depth:    "));
    if (!isnan(d.depthM) && d.depthM >= 0.0f && d.depthM < 100.0f) {
        _display.print(d.depthM, 2);
        _display.println(F(" m"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 27);
    _display.print(F("Pressure: "));
    if (!isnan(d.pressureHPa) && d.pressureHPa > 300.0f && d.pressureHPa < 1200.0f) {
        _display.print(d.pressureHPa, 1);
        _display.println(F(" hPa"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 39);
    _display.print(F("Temp:     "));
    if (!isnan(d.tempC) && d.tempC > -40.0f && d.tempC < 85.0f) {
        _display.print(d.tempC, 1);
        _display.println(F(" C"));
    } else {
        _display.println(F("--"));
    }

    _display.setCursor(4, 51);
    _display.print(F("Sensors:  "));
    _display.println(d.sensorsOk ? F("ONLINE") : F("CHECK"));
}

// ---- Main Measurement Display Update (Smooth Rotation, No Alert Hijack) -----

void oledUpdate(const OledData &data) {
    if (!_oledAvailable) return;

    uint32_t now = millis();

    // Rotate screens every OLED_SCREEN_ROTATION_MS (default 3.5s)
    if (now - _lastRotationMs >= OLED_SCREEN_ROTATION_MS) {
        _lastRotationMs = now;
        _currentScreen = (OledScreen)((_currentScreen + 1) % SCREEN_COUNT);
    }

    // Render the active measurement screen
    switch (_currentScreen) {
        case SCREEN_SYSTEM:
            renderSystemScreen(data);
            break;
        case SCREEN_MAGNETIC:
            renderMagneticScreen(data);
            break;
        case SCREEN_WATER_QUALITY:
            renderWaterQualityScreen(data);
            break;
        case SCREEN_PRESSURE_DEPTH:
        default:
            renderPressureDepthScreen(data);
            break;
    }

    _display.display();
}

void oledNextScreen() {
    _currentScreen = (OledScreen)((_currentScreen + 1) % SCREEN_COUNT);
    _lastRotationMs = millis();
}

void oledSetScreen(OledScreen screen) {
    if (screen < SCREEN_COUNT) {
        _currentScreen = screen;
        _lastRotationMs = millis();
    }
}

OledScreen oledGetCurrentScreen() {
    return _currentScreen;
}
