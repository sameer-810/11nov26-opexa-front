import { api, apiBlob } from '../../../shared/api/apiClient';
import type { AssignableUser, BoqItem, BoqItemInput, ImportResult, Project, ProjectInput } from '../types';

export const projectApi = {
  list: () => api<Project[]>('/projects'),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (body: ProjectInput & { memberIds?: string[] }) => api<Project>('/projects', { method: 'POST', body }),
  update: (id: string, body: Partial<ProjectInput>) => api<Project>(`/projects/${id}`, { method: 'PATCH', body }),
  setMembers: (id: string, memberIds: string[]) => api<Project>(`/projects/${id}/members`, { method: 'PUT', body: { memberIds } }),
  assignableUsers: () => api<AssignableUser[]>('/projects/assignable-users'),

  boq: (id: string) => api<BoqItem[]>(`/projects/${id}/boq`),
  addItem: (id: string, body: BoqItemInput) => api<BoqItem>(`/projects/${id}/boq`, { method: 'POST', body }),
  updateItem: (id: string, itemId: string, body: Partial<BoqItemInput>) => api<BoqItem>(`/projects/${id}/boq/${itemId}`, { method: 'PATCH', body }),
  deleteItem: (id: string, itemId: string) => api<{ deleted: boolean }>(`/projects/${id}/boq/${itemId}`, { method: 'DELETE' }),
  importBoq: (id: string, form: FormData, dryRun: boolean) =>
    api<ImportResult>(`/projects/${id}/boq/import${dryRun ? '?dryRun=true' : ''}`, { method: 'POST', body: form }),
  template: () => apiBlob('/projects/boq-template'),
};
