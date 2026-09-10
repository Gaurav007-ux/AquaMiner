"""
AquaYantra — Wired USB Serial Bridge (serial_bridge.py)

Connects directly to the ESP32 via USB COM port at 115200 baud:
- Reads real-time NEO-6M GPS stream and posts to http://localhost:8000/api/v1/readings
- Captures SD card CSV dumps and feeds them directly to the ML model

Usage:
    python serial_bridge.py [COM_PORT]
Example:
    python serial_bridge.py COM3
"""

import sys
import time
import json
import serial
import serial.tools.list_ports
import httpx

BACKEND_URL = "http://localhost:8000"


def find_esp32_port() -> str | None:
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = (p.description or "").lower()
        if "cp210" in desc or "ch340" in desc or "usb" in desc or "serial" in desc:
            return p.device
    return ports[0].device if ports else None


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else find_esp32_port()

    if not port:
        print("[-] No serial COM ports detected. Please plug in the ESP32 via USB.")
        sys.exit(1)

    print("=" * 60)
    print(" AQUAYANTRA — WIRED USB SERIAL BRIDGE (100% WIRED)")
    print("=" * 60)
    print(f"[*] Connecting to ESP32 on port: {port} @ 115200 baud...")

    try:
        ser = serial.Serial(port, 115200, timeout=1.0)
        time.sleep(1.0)
        print(f"[+] Connected to {port} successfully!")
    except Exception as e:
        print(f"[-] Error opening {port}: {e}")
        sys.exit(1)

    client = httpx.Client(timeout=10.0)
    csv_collecting = False
    csv_lines = []

    print("[*] Listening for live GPS telemetry and SD card dumps over USB...")
    print("[*] (Press Ctrl+C to stop)")

    try:
        while True:
            raw = ser.readline().decode("utf-8", errors="ignore").strip()
            if not raw:
                continue

            # 1. SD Card CSV Framing
            if raw == "===BEGIN_SD_CSV===":
                csv_collecting = True
                csv_lines = []
                print("\n[+] Receiving SD Card survey dump over USB...")
                continue

            if raw == "===END_SD_CSV===":
                csv_collecting = False
                full_csv = "\n".join(csv_lines)
                print(f"[+] Received {len(csv_lines)} CSV lines over USB. Uploading directly to ML Model...")

                try:
                    res = client.post(
                        f"{BACKEND_URL}/api/v1/readings/upload-csv",
                        content=full_csv.encode("utf-8"),
                        headers={"Content-Type": "text/csv"},
                    )
                    if res.status_code in (200, 201):
                        data = res.json()
                        print(f"[+] ML Ingestion Success: {data.get('message')}")
                        print(f"[+] Processed: {data.get('processed_rows')}, Anomalies: {data.get('anomalies_detected')}")
                    else:
                        print(f"[-] Backend returned HTTP {res.status_code}: {res.text}")
                except Exception as ex:
                    print(f"[-] Upload to backend failed: {ex}")

                csv_lines = []
                continue

            if csv_collecting:
                if not raw.startswith("#"):
                    csv_lines.append(raw)
                continue

            # 2. Real-time GPS JSON packet
            if raw.startswith("{") and raw.endswith("}"):
                try:
                    packet = json.loads(raw)
                    if packet.get("type") == "gps":
                        valid = packet.get("valid", False)
                        lat = packet.get("lat")
                        lon = packet.get("lon")
                        sats = packet.get("satellites", 0)

                        if valid and lat is not None and lon is not None:
                            print(f"[GPS LOCK] Lat: {lat:.6f}° | Lon: {lon:.6f}° | Sats: {sats}")
                            # Forward real GPS packet to backend
                            payload = {
                                "device_id": "AQUAYANTRA-001",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                "latitude": lat,
                                "longitude": lon,
                                "depth": 0.0,
                                "battery_voltage": 4.15,
                                "battery_percent": 100.0,
                                "extra": {"satellites": sats, "valid": True},
                            }
                            try:
                                client.post(f"{BACKEND_URL}/api/v1/readings", json=payload)
                            except Exception:
                                pass
                        else:
                            print(f"[GPS SEARCHING] Sats: {sats} | Awaiting 3D fix...")
                except json.JSONDecodeError:
                    pass
            else:
                print(f"[ESP32] {raw}")

    except KeyboardInterrupt:
        print("\n[*] Stopping serial bridge.")
    finally:
        ser.close()
        client.close()


if __name__ == "__main__":
    main()
