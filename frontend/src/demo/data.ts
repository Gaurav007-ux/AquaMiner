/* ============================================================
   AquaYantra — Demo data generator
   Produces realistic sensor telemetry matching backend schemas.
   Runs entirely client-side; same 8 scenarios as backend simulator.
   ============================================================ */

import type { LiveTelemetry, AnalyticsSummary, Mission, Deployment, Device, CalibrationStatus, SystemHealth } from '../types';
import type { DemoScenario } from '../stores';

// ── Noise helper ────────────────────────────────────────────

function gaussNoise(std = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Telemetry Generator ─────────────────────────────────────

let sampleIndex = 0;
const BG_X = 20.0, BG_Y = -5.0, BG_Z = 40.0;
const BASELINE = Math.sqrt(BG_X ** 2 + BG_Y ** 2 + BG_Z ** 2);

export function generateTelemetry(scenario: DemoScenario): LiveTelemetry {
  sampleIndex++;
  const t = sampleIndex;
  const ts = new Date().toISOString();

  let mx = BG_X + gaussNoise(0.5);
  let my = BG_Y + gaussNoise(0.5);
  let mz = BG_Z + gaussNoise(0.5);
  let anomalyScore = 0;
  let confidence = 0;
  let detectionStatus = 'BACKGROUND';
  let dataQuality = 0.95;
  let sensorHealth = 'HEALTHY';
  let batteryVoltage = 12.6 - (t % 3000) * 0.0005;

  // Depth simulation
  const depth = 15 + 3 * Math.sin(t * 0.02) + gaussNoise(0.3);
  const turbidity = 5 + gaussNoise(1.5);

  // GPS track (slow survey path)
  const lat = 28.6139 + t * 0.000008 * Math.cos(t * 0.003);
  const lon = 77.2090 + t * 0.000008 * Math.sin(t * 0.003);

  // Scenario-specific behavior
  switch (scenario) {
    case 'WEAK_ANOMALY': {
      const center = 150;
      const dist = Math.abs(t % 300 - center);
      if (dist < 30) {
        const env = 5 * Math.exp(-0.5 * (dist / 10) ** 2);
        mz += env;
        anomalyScore = clamp(0.3 + env * 0.08, 0, 1);
        confidence = clamp(anomalyScore * 0.7, 0, 1);
        if (anomalyScore > 0.5) detectionStatus = 'WATCH';
      }
      break;
    }
    case 'STRONG_ANOMALY': {
      const center = 150;
      const dist = Math.abs(t % 300 - center);
      if (dist < 40) {
        const env = 30 * Math.exp(-0.5 * (dist / 12) ** 2);
        mz += env;
        mx += env * 0.3;
        anomalyScore = clamp(0.4 + env * 0.02, 0, 1);
        confidence = clamp(anomalyScore * 0.9, 0, 1);
        if (anomalyScore > 0.75) detectionStatus = 'CONFIRMED_EVENT';
        else if (anomalyScore > 0.5) detectionStatus = 'CANDIDATE';
        else if (anomalyScore > 0.3) detectionStatus = 'WATCH';
      }
      break;
    }
    case 'MULTIPLE_TARGETS': {
      for (const c of [75, 150, 225]) {
        const dist = Math.abs(t % 300 - c);
        if (dist < 20) {
          const str = 8 + Math.random() * 15;
          const env = str * Math.exp(-0.5 * (dist / 8) ** 2);
          mz += env;
          const score = clamp(0.3 + env * 0.03, 0, 1);
          if (score > anomalyScore) {
            anomalyScore = score;
            confidence = clamp(score * 0.85, 0, 1);
            detectionStatus = score > 0.65 ? 'CANDIDATE' : 'WATCH';
          }
        }
      }
      break;
    }
    case 'SENSOR_DRIFT': {
      const drift = (t % 600) * 0.015;
      mx += drift;
      my += drift * 0.5;
      dataQuality = clamp(0.95 - drift * 0.02, 0.4, 1);
      break;
    }
    case 'HIGH_NOISE':
      mx += gaussNoise(4);
      my += gaussNoise(4);
      mz += gaussNoise(4);
      dataQuality = 0.5;
      break;
    case 'PACKET_LOSS':
      if (Math.random() < 0.1) dataQuality = 0;
      break;
    case 'SENSOR_FAILURE':
      if (t % 300 > 210) {
        mx = 0; my = 0; mz = 0;
        sensorHealth = 'FAULT';
        dataQuality = 0.1;
        detectionStatus = 'NO_MAG_DATA';
      }
      break;
    default: // NORMAL_SURVEY
      break;
  }

  const magnitude = Math.sqrt(mx ** 2 + my ** 2 + mz ** 2);
  const deviation = magnitude - BASELINE;

  return {
    timestamp: ts,
    depth: Math.round(depth * 100) / 100,
    magnetic_magnitude: Math.round(magnitude * 100) / 100,
    magnetic_baseline: Math.round(BASELINE * 100) / 100,
    magnetic_deviation: Math.round(deviation * 100) / 100,
    mag_x: Math.round(mx * 100) / 100,
    mag_y: Math.round(my * 100) / 100,
    mag_z: Math.round(mz * 100) / 100,
    anomaly_score: Math.round(anomalyScore * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    turbidity: Math.round(Math.max(0, turbidity) * 10) / 10,
    battery_voltage: Math.round(batteryVoltage * 100) / 100,
    battery_percent: Math.round(clamp((batteryVoltage - 9) / 3.6 * 100, 0, 100)),
    data_quality: Math.round(dataQuality * 100) / 100,
    detection_status: detectionStatus,
    sensor_health: sensorHealth,
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lon * 1000000) / 1000000,
  };
}

export function resetGenerator(): void {
  sampleIndex = 0;
}

// ── Static demo data ────────────────────────────────────────

export const DEMO_MISSION: Mission = {
  id: 'demo-mission-001',
  name: 'Demo Survey — Mumbai Harbor',
  description: 'Demonstration survey for AquaYantra platform validation',
  operator: 'AquaYantra Demo',
  status: 'active',
  start_time: new Date().toISOString(),
  end_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_DEPLOYMENT: Deployment = {
  id: 'demo-deploy-001',
  mission_id: 'demo-mission-001',
  device_id: 'demo-device-001',
  deployment_number: 1,
  status: 'active',
  start_time: new Date().toISOString(),
  end_time: null,
  maximum_depth: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_DEVICE: Device = {
  id: 'demo-device-001',
  device_serial: 'AQUAYANTRA-SIM-001',
  name: 'AquaYantra Unit Alpha',
  firmware_version: '1.2.0',
  hardware_version: '2.0',
  description: 'Primary survey unit',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sensors: [
    { id: 's1', device_id: 'demo-device-001', sensor_type: 'magnetometer', model: 'QMC5883L', serial_number: null, configuration: null, status: 'active', calibration_version: 1 },
    { id: 's2', device_id: 'demo-device-001', sensor_type: 'turbidity', model: 'SEN0189', serial_number: null, configuration: null, status: 'active', calibration_version: 0 },
    { id: 's3', device_id: 'demo-device-001', sensor_type: 'pressure', model: 'BMP280', serial_number: null, configuration: null, status: 'active', calibration_version: 0 },
    { id: 's4', device_id: 'demo-device-001', sensor_type: 'gps', model: 'NEO-6M', serial_number: null, configuration: null, status: 'active', calibration_version: 0 },
  ],
};

export const DEMO_CALIBRATION: CalibrationStatus = {
  device_id: 'AQUAYANTRA-SIM-001',
  status: 'calibrated',
  calibration_quality: 0.92,
  baseline: BASELINE,
  noise_level: 0.5,
  sample_count: 1240,
  hard_iron_offset: [0.3, -0.15, 0.22],
  message: 'Calibration active, tracking baseline',
};

export const DEMO_ANALYTICS: AnalyticsSummary = {
  total_devices: 1,
  active_devices: 1,
  total_missions: 1,
  active_missions: 1,
  total_deployments: 1,
  total_readings: 0,
  total_detections: 0,
  total_targets: 0,
  average_anomaly_score: null,
  last_reading_at: null,
};

export const DEMO_SYSTEM_HEALTH: SystemHealth = {
  status: 'healthy',
  database: 'healthy',
  redis: 'healthy',
  ml_service: 'active',
  websocket_connections: 1,
  active_devices: 1,
  processing_latency_ms: 12.4,
  last_sensor_timestamp: new Date().toISOString(),
  uptime_seconds: 3600,
  version: '0.1.0',
};
