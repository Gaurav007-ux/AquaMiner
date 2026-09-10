import api from './client';
import type { Device, DeviceCreate } from '../types';

export const devicesApi = {
  list: () => api.get<Device[]>('/api/v1/devices'),
  get: (id: string) => api.get<Device>(`/api/v1/devices/${id}`),
  create: (data: DeviceCreate) => api.post<Device>('/api/v1/devices', data),
  update: (id: string, data: Partial<DeviceCreate>) =>
    api.patch<Device>(`/api/v1/devices/${id}`, data),
};
