import { api } from '../../../shared/api/apiClient';
import type { AuthResponse, Organization, SignInInput, SignUpInput, User } from '../types';

export const authApi = {
  signUp: (body: SignUpInput) => api<AuthResponse>('/auth/signup', { method: 'POST', body, auth: false }),
  signIn: (body: SignInInput) => api<AuthResponse>('/auth/signin', { method: 'POST', body, auth: false }),
  refresh: (refreshToken: string) => api<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }),
  signOut: (refreshToken: string) => api<{ signedOut: boolean }>('/auth/signout', { method: 'POST', body: { refreshToken }, auth: false }),
  me: () => api<{ user: User; organization: Organization }>('/auth/me'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<User>('/auth/change-password', { method: 'POST', body }),
};
