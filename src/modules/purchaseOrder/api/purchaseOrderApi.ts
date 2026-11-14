import { api } from '../../../shared/api/apiClient';
import type { NewDispatch, NewPo, ProjectLot, PurchaseOrder } from '../types';

export const purchaseOrderApi = {
  list: (q: { requisitionId?: string; projectId?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return api<PurchaseOrder[]>(`/purchase-orders${p ? `?${p}` : ''}`);
  },
  get: (id: string) => api<PurchaseOrder>(`/purchase-orders/${id}`),
  create: (body: NewPo) => api<PurchaseOrder>('/purchase-orders', { method: 'POST', body }),
  cancel: (id: string, reason: string) => api<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  dispatch: (id: string, body: NewDispatch) => api<{ id: string; lotNo: number; purchaseOrder: PurchaseOrder }>(`/purchase-orders/${id}/dispatches`, { method: 'POST', body }),
  projectLots: (projectId: string) => api<ProjectLot[]>(`/projects/${projectId}/lots`),
};
