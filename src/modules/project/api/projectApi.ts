import { api, apiBlob } from '../../../shared/api/apiClient';
import type { AssignableUser, ProjectSite, SiteInput, BoqColumn, BoqFormat, BoqItem, BoqItemInput, BoqView, ImportResult, MilestoneInput, MilestoneList, Project, ProjectInput } from '../types';

export const projectApi = {
  list: () => api<Project[]>('/projects'),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (body: ProjectInput & { memberIds?: string[] }) => api<Project>('/projects', { method: 'POST', body }),
  update: (id: string, body: Partial<ProjectInput>) => api<Project>(`/projects/${id}`, { method: 'PATCH', body }),
  setMembers: (id: string, memberIds: string[]) => api<Project>(`/projects/${id}/members`, { method: 'PUT', body: { memberIds } }),
  assignableUsers: () => api<AssignableUser[]>('/projects/assignable-users'),
  // Phase 2 access: a project's sites (people limited to some sites get only theirs).
  sites: (id: string) => api<ProjectSite[]>(`/projects/${id}/sites`),
  addSite: (id: string, body: SiteInput) => api<ProjectSite>(`/projects/${id}/sites`, { method: 'POST', body }),
  updateSite: (id: string, siteId: string, body: Partial<SiteInput> & { isActive?: boolean }) => api<ProjectSite>(`/projects/${id}/sites/${siteId}`, { method: 'PATCH', body }),

  boq: (id: string) => api<BoqItem[]>(`/projects/${id}/boq`),
  addItem: (id: string, body: BoqItemInput) => api<BoqItem>(`/projects/${id}/boq`, { method: 'POST', body }),
  updateItem: (id: string, itemId: string, body: Partial<BoqItemInput>) => api<BoqItem>(`/projects/${id}/boq/${itemId}`, { method: 'PATCH', body }),
  deleteItem: (id: string, itemId: string) => api<{ deleted: boolean }>(`/projects/${id}/boq/${itemId}`, { method: 'DELETE' }),
  importBoq: (id: string, form: FormData, dryRun: boolean) =>
    api<ImportResult>(`/projects/${id}/boq/import${dryRun ? '?dryRun=true' : ''}`, { method: 'POST', body: form }),
  template: (format: BoqFormat = 'sitc') => apiBlob(`/projects/boq-template${format === 'sitc' ? '' : `?format=${format}`}`),
  boqView: (id: string) => api<BoqView>(`/projects/${id}/boq-view`),
  exportBoq: (id: string) => apiBlob(`/projects/${id}/boq-export`),
  saveColumns: (id: string, columns: BoqColumn[]) => api<BoqColumn[]>(`/projects/${id}/boq-columns`, { method: 'PUT', body: { columns } }),

  milestones: (id: string) => api<MilestoneList>(`/projects/${id}/milestones`),
  addMilestone: (id: string, body: MilestoneInput) => api<MilestoneList>(`/projects/${id}/milestones`, { method: 'POST', body }),
  updateMilestone: (id: string, mid: string, body: Partial<MilestoneInput>) => api<MilestoneList>(`/projects/${id}/milestones/${mid}`, { method: 'PATCH', body }),
  removeMilestone: (id: string, mid: string) => api<MilestoneList>(`/projects/${id}/milestones/${mid}`, { method: 'DELETE' }),
};
