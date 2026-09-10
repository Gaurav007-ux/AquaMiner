import api from './client';
import type {
  Mission, MissionCreate, Deployment, DeploymentCreate,
  ReadingCompact, DetectionEvent, SensorReading,
  CalibrationProfile, CalibrationStatus,
  MLModel, SurveyPoint, TargetCandidate,
  AnalyticsSummary, SystemHealth, MineralHeatmapResponse,
} from '../types';


// ── Missions ─────────────────────────────────────────────────
export const missionsApi = {
  list: () => api.get<Mission[]>('/api/v1/missions'),
  get: (id: string) => api.get<Mission>(`/api/v1/missions/${id}`),
  create: (data: MissionCreate) => api.post<Mission>('/api/v1/missions', data),
  update: (id: string, data: Partial<MissionCreate & { status: string }>) =>
    api.patch<Mission>(`/api/v1/missions/${id}`, data),
};

// ── Deployments ──────────────────────────────────────────────
export const deploymentsApi = {
  create: (data: DeploymentCreate) =>
    api.post<Deployment>('/api/v1/deployments', data),
  get: (id: string) => api.get<Deployment>(`/api/v1/deployments/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Deployment>(`/api/v1/deployments/${id}`, data),
  readings: (id: string, offset = 0, limit = 100) =>
    api.get<ReadingCompact[]>(`/api/v1/deployments/${id}/readings`, { offset, limit }),
  anomalies: (id: string) =>
    api.get<DetectionEvent[]>(`/api/v1/deployments/${id}/anomalies`),
};

// ── Readings ─────────────────────────────────────────────────
export const readingsApi = {
  query: (params: Record<string, string | number | boolean | undefined>) =>
    api.get<SensorReading[]>('/api/v1/readings', params),
  latest: (deviceId?: string) =>
    api.get<ReadingCompact | null>('/api/v1/readings/latest', { device_id: deviceId }),
  ingest: (data: Record<string, unknown>) =>
    api.post<Record<string, unknown>>('/api/v1/readings', data),
  uploadCsv: (file: File, baseLat?: number, baseLon?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    let path = '/api/v1/readings/upload-csv';
    if (baseLat !== undefined && baseLon !== undefined) {
      path += `?base_lat=${baseLat}&base_lon=${baseLon}`;
    }
    return api.upload<{
      status: string;
      processed_rows: number;
      anomalies_detected: number;
      message: string;
    }>(path, formData);
  },
};

// ── Calibration ──────────────────────────────────────────────
export const calibrationApi = {
  history: (deviceId: string) =>
    api.get<CalibrationProfile[]>(`/api/v1/calibration/${deviceId}`),
  status: (deviceId: string) =>
    api.get<CalibrationStatus>(`/api/v1/calibration/${deviceId}/status`),
  reset: (deviceId: string) =>
    api.post<{ status: string }>(`/api/v1/calibration/${deviceId}/reset`),
};

// ── ML ───────────────────────────────────────────────────────
export const mlApi = {
  models: () => api.get<MLModel[]>('/api/v1/ml/models'),
  model: (id: string) => api.get<MLModel>(`/api/v1/ml/models/${id}`),
  train: (data: { model_type: string; name?: string }) =>
    api.post<{ status: string }>('/api/v1/ml/train', data),
  activate: (id: string) =>
    api.post<{ status: string }>(`/api/v1/ml/models/${id}/activate`),
};

// ── Map ──────────────────────────────────────────────────────
export const mapApi = {
  surveyPoints: (params?: { deployment_id?: string; limit?: number }) =>
    api.get<SurveyPoint[]>('/api/v1/map/survey-points', params),
  anomalies: (limit = 200) =>
    api.get<DetectionEvent[]>('/api/v1/map/anomalies', { limit }),
  targets: () => api.get<TargetCandidate[]>('/api/v1/map/targets'),
  heatmap: (params?: { deployment_id?: string; limit?: number }) =>
    api.get<MineralHeatmapResponse>('/api/v1/map/heatmap', params),
};


// ── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>('/api/v1/analytics/summary'),
};

// ── System ───────────────────────────────────────────────────
export const systemApi = {
  health: () => api.get<SystemHealth>('/api/v1/system/health'),
};
