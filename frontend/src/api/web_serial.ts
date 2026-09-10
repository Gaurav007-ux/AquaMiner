/* ============================================================
   AquaYantra — Web Serial Manager (Direct USB COM Port Connection)
   Enables 100% wired communication between the browser and ESP32
   ESP32 is now dedicated to NEO-6M GPS only.
   ============================================================ */

export interface GpsTelemetryPacket {
  type: 'gps';
  valid: boolean;
  satellites: number;
  lat: number | null;
  lon: number | null;
  alt?: number;
  hdop?: number;
  speed_knots?: number;
  time?: string;     // UTC time string from NMEA (ISO or HH:MM:SS)
  uptime_s?: number;
  mode?: string;
  status?: string;
  rx_bytes?: number;
}

type GpsCallback = (gps: GpsTelemetryPacket) => void;
type StatusCallback = (connected: boolean, portName?: string) => void;

class WebSerialManager {
  private port: any | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private isReading = false;
  private gpsCallbacks: Set<GpsCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private lastGpsLat: number | null = null;
  private lastGpsLon: number | null = null;
  private lastGpsTime: string | null = null;
  private lastPacket: GpsTelemetryPacket | null = null;

  get isConnected(): boolean {
    return this.port !== null;
  }

  get currentGps(): { lat: number | null; lon: number | null; time: string | null } {
    return { lat: this.lastGpsLat, lon: this.lastGpsLon, time: this.lastGpsTime };
  }

  get latestGpsPacket(): GpsTelemetryPacket | null {
    return this.lastPacket;
  }

  async toggleSim(): Promise<void> {
    await this.sendCommand('SIM');
  }

  onGps(cb: GpsCallback): () => void {
    this.gpsCallbacks.add(cb);
    return () => this.gpsCallbacks.delete(cb);
  }

  onStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome, Edge, Brave, or Opera.');
    }

    try {
      // Prompt user to select ESP32 COM Port
      // @ts-expect-error - navigator.serial is available in modern Chromium browsers
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.notifyStatus(true);
      this.startReading();
      return true;
    } catch (err) {
      this.port = null;
      this.notifyStatus(false);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      // Ignored during cleanup
    }
    this.notifyStatus(false);
  }

  async sendCommand(cmd: string): Promise<void> {
    if (!this.port) {
      throw new Error('COM port not connected');
    }

    const encoder = new TextEncoderStream();
    const writableStreamClosed = encoder.readable.pipeTo(this.port.writable);
    const writer = encoder.writable.getWriter();
    await writer.write(cmd.endsWith('\n') ? cmd : cmd + '\n');
    await writer.close();
    await writableStreamClosed;
  }

  private notifyStatus(connected: boolean) {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }

  private async startReading() {
    if (!this.port) return;
    this.isReading = true;

    while (this.port.readable && this.isReading) {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable).catch(() => {});
      this.reader = textDecoder.readable.getReader();


      let lineBuffer = '';

      try {
        while (this.isReading) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (!value) continue;

          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            this.processLine(line.trim());
          }
        }
      } catch {
        // Read error or port disconnected
      } finally {
        this.reader?.releaseLock();
      }
    }
  }

  private processLine(line: string) {
    if (!line) return;

    // JSON Telemetry line
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const data = JSON.parse(line);
        if (data.type === 'gps') {
          if (data.valid && data.lat != null && data.lon != null) {
            this.lastGpsLat = data.lat;
            this.lastGpsLon = data.lon;
          }
          if (data.time) {
            this.lastGpsTime = data.time;
          }
          this.lastPacket = data as GpsTelemetryPacket;
          this.gpsCallbacks.forEach((cb) => cb(data as GpsTelemetryPacket));
        }
      } catch {
        // Malformed JSON ignored
      }
    }
  }
}

export const webSerial = new WebSerialManager();
