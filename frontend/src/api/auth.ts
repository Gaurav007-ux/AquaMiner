import api, { setAccessToken } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../types';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/api/v1/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/api/v1/auth/register', data),

  me: () => api.get<UserProfile>('/api/v1/auth/me'),

  logout: () => {
    setAccessToken(null);
  },
};
