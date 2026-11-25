import { api } from '../../../shared/api/apiClient';
import type { AssignmentInput, AssignmentOptions, Assignments, MemberUpdate, NewMemberInput, TeamMember, TeamMeta } from '../types';

export const teamApi = {
  meta: () => api<TeamMeta>('/users/meta'),
  list: () => api<TeamMember[]>('/users'),
  get: (id: string) => api<TeamMember>(`/users/${id}`),
  create: (body: NewMemberInput) => api<TeamMember>('/users', { method: 'POST', body }),
  update: (id: string, body: MemberUpdate) => api<TeamMember>(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, password: string) => api<TeamMember>(`/users/${id}/reset-password`, { method: 'POST', body: { password } }),
  assignmentOptions: () => api<AssignmentOptions>('/users/assignment-options'),
  assignments: (id: string) => api<Assignments>(`/users/${id}/assignments`),
  saveAssignments: (id: string, assignments: AssignmentInput[]) => api<Assignments>(`/users/${id}/assignments`, { method: 'PUT', body: { assignments } }),
};
