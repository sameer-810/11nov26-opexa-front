import { api } from '../../../shared/api/apiClient';
import type { LocalPurchase, Lot, MaterialStatus, NewLocalPurchase, ReceiveInput } from '../types';

export type LotToReceive = Lot & { projectId: string; projectName: string | null; projectCode: string | null };

export const receivingApi = {
  toReceive: () => api<LotToReceive[]>('/lots/to-receive'),
  lots: (projectId: string, status?: 'pending') => api<Lot[]>(`/projects/${projectId}/lots${status ? `?status=${status}` : ''}`),
  lot: (projectId: string, lotId: string) => api<Lot>(`/projects/${projectId}/lots/${lotId}`),
  receive: (projectId: string, lotId: string, body: ReceiveInput) => api<Lot>(`/projects/${projectId}/lots/${lotId}/receive`, { method: 'POST', body }),
  localPurchases: (projectId: string) => api<LocalPurchase[]>(`/projects/${projectId}/local-purchases`),
  addLocalPurchase: (projectId: string, body: NewLocalPurchase) => api<LocalPurchase>(`/projects/${projectId}/local-purchases`, { method: 'POST', body }),
  material: (projectId: string) => api<MaterialStatus>(`/projects/${projectId}/material`),
};
