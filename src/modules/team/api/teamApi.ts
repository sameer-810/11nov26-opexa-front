import { api } from '../../../shared/api/apiClient';
import type { MemberUpdate, NewMemberInput, TeamMember, TeamMeta } from '../types';

export const teamApi = {
  meta: () => api<TeamMeta>('/users/meta'),
  list: () => api<TeamMember[]>('/users'),
  get: (id: string) => api<TeamMember>(`/users/${id}`),
  create: (body: NewMemberInput) => api<TeamMember>('/users', { method: 'POST', body }),
  update: (id: string, body: MemberUpdate) => api<TeamMember>(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, password: string) => api<TeamMember>(`/users/${id}/reset-password`, { method: 'POST', body: { password } }),
};
