import { api } from '../../../shared/api/apiClient';
import type { BalanceRow, NewRequisition, Requisition } from '../types';

export const requisitionApi = {
  balance: (projectId: string) => api<BalanceRow[]>(`/projects/${projectId}/boq-balance`),
  create: (projectId: string, body: NewRequisition) => api<Requisition>(`/projects/${projectId}/requisitions`, { method: 'POST', body }),
  list: (q: { projectId?: string; overBoq?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (q.projectId) params.set('projectId', q.projectId);
    if (q.overBoq) params.set('overBoq', 'true');
    const s = params.toString();
    return api<Requisition[]>(`/requisitions${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api<Requisition>(`/requisitions/${id}`),
  cancel: (id: string, reason: string) => api<Requisition>(`/requisitions/${id}/cancel`, { method: 'POST', body: { reason } }),
};
