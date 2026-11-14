import { api } from '../../../shared/api/apiClient';
import type { MaterialReturn, NewReturn, NewStockCount, NewUsage, StockCount, Usage } from '../types';

export type TransferTarget = { id: string; code: string; name: string };
export type TargetItem = { id: string; serialNo: string; description: string; unit: string };

export const materialApi = {
  transferTargets: () => api<TransferTarget[]>('/transfer-targets'),
  transferTargetItems: (projectId: string) => api<TargetItem[]>(`/transfer-targets/${projectId}/items`),
  returns: (projectId?: string, status?: string) =>
    api<MaterialReturn[]>(`${projectId ? `/projects/${projectId}/returns` : '/returns'}${status ? `?status=${status}` : ''}`),
  getReturn: (id: string) => api<MaterialReturn>(`/returns/${id}`),
  createReturn: (projectId: string, body: NewReturn) => api<MaterialReturn>(`/projects/${projectId}/returns`, { method: 'POST', body }),
  decide: (id: string, decision: 'accepted' | 'rejected', note?: string) => api<MaterialReturn>(`/returns/${id}/decision`, { method: 'POST', body: { decision, note } }),
  usage: (projectId: string) => api<Usage[]>(`/projects/${projectId}/usage`),
  addUsage: (projectId: string, body: NewUsage) => api<Usage>(`/projects/${projectId}/usage`, { method: 'POST', body }),
  counts: (projectId: string) => api<StockCount[]>(`/projects/${projectId}/stock-counts`),
  count: (projectId: string, id: string) => api<StockCount>(`/projects/${projectId}/stock-counts/${id}`),
  addCount: (projectId: string, body: NewStockCount) => api<StockCount>(`/projects/${projectId}/stock-counts`, { method: 'POST', body }),
};
