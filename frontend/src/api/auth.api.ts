import { apiClient } from './client';
import type { AuthUser } from '../types';

export interface LoginResponse {
  accessToken?: string;
  user?: AuthUser;
  mfaRequired?: boolean;
  userId?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),

  mfaVerify: (userId: string, code: string, isBackupCode = false) =>
    apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/mfa/verify', {
      userId, code, isBackupCode,
    }),

  refresh: () =>
    apiClient.post<{ accessToken: string }>('/auth/refresh'),

  logout: () =>
    apiClient.post('/auth/logout'),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),

  enrollMfa: () =>
    apiClient.post<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] }>('/auth/mfa/enroll'),

  disableMfa: () =>
    apiClient.post('/auth/mfa/disable'),

  regenerateBackupCodes: () =>
    apiClient.post<{ backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate'),
};
