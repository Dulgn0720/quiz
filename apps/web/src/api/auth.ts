import type {
  AppSettings,
  AuthResponse,
  GameHistoryEntry,
  LoginRequest,
  Paginated,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfile,
  UserPublic,
} from '@quiz/shared';
import { request } from './client';

export const authApi = {
  register(body: RegisterRequest): Promise<AuthResponse> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },
  login(body: LoginRequest): Promise<AuthResponse> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  settings(): Promise<AppSettings> {
    return request('/settings');
  },
  forgotPassword(email: string): Promise<void> {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  resetPassword(token: string, password: string): Promise<AuthResponse> {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
  },
  me(): Promise<UserProfile> {
    return request('/me');
  },
  updateMe(body: UpdateProfileRequest): Promise<UserPublic> {
    return request('/me', { method: 'PATCH', body: JSON.stringify(body) });
  },
  history(page = 1, pageSize = 20): Promise<Paginated<GameHistoryEntry>> {
    return request(`/me/games?page=${page}&pageSize=${pageSize}`);
  },
};
