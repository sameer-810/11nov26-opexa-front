import { api } from '../../shared/api/apiClient';

export type Department = { id: string; name: string; code: string; isActive: boolean };

export const departmentApi = {
  list: (all = false) => api<Department[]>(`/departments${all ? '?all=true' : ''}`),
  create: (body: { name: string; code?: string }) => api<Department>('/departments', { method: 'POST', body }),
  update: (id: string, body: Partial<{ name: string; code: string; isActive: boolean }>) => api<Department>(`/departments/${id}`, { method: 'PATCH', body }),
};
