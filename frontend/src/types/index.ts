/* ============================================================
   AquaYantra — Core TypeScript types
   Maps 1:1 to backend Pydantic schemas
   ============================================================ */

// ── Common ──────────────────────────────────────────────────

export type UUID = string;
export type ISODate = string;

export type Role = 'admin' | 'operator' | 'viewer';

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

// ── Auth ────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface UserProfile {
  id: UUID;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: ISODate;
}

// ── Device ──────────────────────────────────────────────────

export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'retired';

export interface Device {
  id: UUID;
  device_serial: string;
  name: string;
  firmware_version: string | null;
  hardware_version: string | null;
  description: string | null;
  status: DeviceStatus;
  created_at: ISODate;
  updated_at: ISODate;
  sensors: Sensor[];
}

export interface DeviceCreate {
  device_serial: string;
  name: string;
  firmware_version?: string;
  hardware_version?: string;
  description?: string;
}

export interface Sensor {
  id: UUID;
  device_id: UUID;
  sensor_type: string;
  model: string | null;
  serial_number: string | null;
  configuration: Record<string, unknown> | null;
  status: string;
  calibration_version: number;
}

// ── Mission ─────────────────────────────────────────────────

export type MissionStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived';

export interface Mission {
  id: UUID;
  name: string;
  description: string | null;
  operator: string | null;
  status: MissionStatus;
  start_time: ISODate | null;
  end_time: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface MissionCreate {
  name: string;
  description?: string;
  operator?: string;
}

// ── Deployment ──────────────────────────────────────────────

export type DeploymentStatus = 'planned' | 'active' | 'paused' | 'completed';

export interface Deployment {
  id: UUID;
  mission_id: UUID;
  device_id: UUID;
  deployment_number: number;
  status: DeploymentStatus;
  start_time: ISODate | null;
  end_time: ISODate | null;
  maximum_depth: number | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface DeploymentCreate {
  mission_id: UUID;
  device_id: UUID;
  deployment_number?: number;
  start_latitude?: number;
  start_longitude?: number;
}

// ── Sensor Reading ──────────────────────────────────────────

export interface SensorReading {
  id: UUID;
  device_id: UUID;
  deployment_id: UUID | null;
  timestamp: ISODate;
  sequence: number | null;
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  magnetometer_x: number | null;
  magnetometer_y: number | null;
  magnetometer_z: number | null;
  magnetic_magnitude: number | null;
  magnetic_baseline: number | null;
  magnetic_deviation: number | null;
  anomaly_score: number | null;
  detection_confidence: number | null;
  turbidity: number | null;
  pressure: number | null;
  battery_voltage: number | null;
  battery_percent: number | null;
  sensor_health: string | null;
  data_quality: number | null;
}

export interface ReadingCompact {
  id: UUID;
  timestamp: ISODate;
  magnetic_magnitude: number | null;
  anomaly_score: number | null;
  detection_confidence: number | null;
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  data_quality: number | null;
}

// ── Detection Event ─────────────────────────────────────────

export type DetectionStatus =
  | 'detected'
  | 'confirmed'
  | 'dismissed'
  | 'investigating';

export interface DetectionEvent {
  id: UUID;
  deployment_id: UUID;
  timestamp: ISODate;
  end_timestamp: ISODate | null;
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  anomaly_score: number;
  confidence: number;
  peak_strength: number | null;
  mean_strength: number | null;
  duration_seconds: number | null;
  sample_count: number | null;
  classification: string | null;
  explanation: Record<string, unknown> | null;
  status: DetectionStatus;
}

// ── Calibration ─────────────────────────────────────────────

export type CalibrationState =
  | 'uncalibrated'
  | 'initializing'
  | 'calibrated'
  | 'adapting'
  | 'frozen'
  | 'low_confidence'
  | 'sensor_fault';

export interface CalibrationProfile {
  id: UUID;
  device_id: UUID;
  sensor_id: UUID | null;
  version: number;
  hard_iron_offset_x: number;
  hard_iron_offset_y: number;
  hard_iron_offset_z: number;
  soft_iron_matrix: Record<string, number> | null;
  axis_scale_x: number;
  axis_scale_y: number;
  axis_scale_z: number;
  baseline: number | null;
  noise_level: number | null;
  calibration_quality: number | null;
  calibration_status: CalibrationState;
  sample_count: number;
  active: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface CalibrationStatus {
  device_id: string;
  status: CalibrationState;
  calibration_quality: number | null;
  baseline: number | null;
  noise_level: number | null;
  sample_count: number;
  hard_iron_offset: number[];
  message: string;
}

// ── ML Model ────────────────────────────────────────────────

export type ModelStatus = 'training' | 'validating' | 'active' | 'retired' | 'failed';

export interface MLModel {
  id: UUID;
  name: string;
  version: number;
  model_type: string;
  description: string | null;
  feature_version: string | null;
  training_samples: number | null;
  training_timestamp: ISODate | null;
  metrics: Record<string, unknown> | null;
  status: ModelStatus;
  created_at: ISODate;
}

// ── Survey Point ────────────────────────────────────────────

export interface SurveyPoint {
  id: UUID;
  deployment_id: UUID;
  timestamp: ISODate;
  latitude: number;
  longitude: number;
  depth: number | null;
  anomaly_score: number | null;
  confidence: number | null;
  target_status: string | null;
  environmental_context: Record<string, unknown> | null;
}

// ── Target ──────────────────────────────────────────────────

export type TargetPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type TargetStatus = 'candidate' | 'confirmed' | 'dismissed';

export interface TargetCandidate {
  target_id: string;
  latitude: number;
  longitude: number;
  observation_count: number;
  peak_anomaly_score: number;
  mean_anomaly_score: number;
  confidence: number;
  spatial_extent_meters: number | null;
  depth_range: number[] | null;
  priority: TargetPriority;
  status: TargetStatus;
}

// ── Analytics ───────────────────────────────────────────────

export interface AnalyticsSummary {
  total_devices: number;
  active_devices: number;
  total_missions: number;
  active_missions: number;
  total_deployments: number;
  total_readings: number;
  total_detections: number;
  total_targets: number;
  average_anomaly_score: number | null;
  last_reading_at: ISODate | null;
}

// ── System Health ───────────────────────────────────────────

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: string;
  redis: string;
  ml_service: string;
  websocket_connections: number;
  active_devices: number;
  processing_latency_ms: number | null;
  last_sensor_timestamp: ISODate | null;
  uptime_seconds: number;
  version: string;
}

// ── Sensor Health ───────────────────────────────────────────

export type HealthLevel = 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'FAULT' | 'OFFLINE';

export interface SensorHealth {
  device_id: string;
  overall_status: HealthLevel;
  magnetometer: HealthLevel;
  turbidity_sensor: HealthLevel;
  pressure_sensor: HealthLevel;
  gps: HealthLevel;
  battery: HealthLevel;
  issues: string[];
  last_reading_at: ISODate | null;
}

// ── WebSocket Messages ──────────────────────────────────────

export type WSMessageType =
  | 'reading'
  | 'detection'
  | 'calibration'
  | 'health'
  | 'heartbeat';

export interface WSMessage {
  type: WSMessageType;
  device_id: string | null;
  deployment_id: string | null;
  timestamp: ISODate;
  data: Record<string, unknown>;
}

// ── Live Telemetry (derived for UI) ─────────────────────────

export interface LiveTelemetry {
  timestamp: ISODate;
  depth: number | null;
  magnetic_magnitude: number | null;
  magnetic_baseline: number | null;
  magnetic_deviation: number | null;
  mag_x: number | null;
  mag_y: number | null;
  mag_z: number | null;
  anomaly_score: number;
  confidence: number;
  turbidity: number | null;
  battery_voltage: number | null;
  battery_percent: number | null;
  data_quality: number;
  detection_status: string;
  sensor_health: string;
  latitude: number | null;
  longitude: number | null;
}

// ── Ingestion Response ──────────────────────────────────────

export interface IngestionResponse {
  status: string;
  device_id: string;
  timestamp: ISODate;
  anomaly_score: number;
  confidence: number;
  detection_status: string;
  quality: number;
  calibration_status: string;
}

// ── Mineral Heatmap ─────────────────────────────────────────

export type MineralType =
  | 'POLYMETALLIC_NODULES'
  | 'MASSIVE_SULFIDES'
  | 'COBALT_CRUSTS'
  | 'FERROMAGNETIC_ANOMALY'
  | 'BACKGROUND';

export interface MineralHeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  mineral_type: MineralType;
  confidence: number;
  anomaly_score: number;
  depth?: number | null;
  magnetic_deviation?: number | null;
  turbidity?: number | null;
  temperature_delta?: number | null;
  ph?: number | null;
  timestamp?: string | null;
}

export interface MineralHeatmapResponse {
  total_points: number;
  mineral_summary: Record<string, number>;
  points: MineralHeatmapPoint[];
}

