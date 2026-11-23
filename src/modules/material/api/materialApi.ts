import { api, apiBlob } from '../../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../../requisition/api/requisitionApi';
import type { Attachment } from '../../requisition/types';
import type { MaterialReturn, NewReturn, NewStockCount, NewUsage, StockCount, Usage, WarehouseChoice } from '../types';

export type TransferTarget = { id: string; code: string; name: string };
export type TargetItem = { id: string; serialNo: string; description: string; unit: string };

export const materialApi = {
  transferTargets: () => api<TransferTarget[]>('/transfer-targets'),
  transferTargetItems: (projectId: string) => api<TargetItem[]>(`/transfer-targets/${projectId}/items`),
  returns: (projectId?: string, status?: string) =>
    api<MaterialReturn[]>(`${projectId ? `/projects/${projectId}/returns` : '/returns'}${status ? `?status=${status}` : ''}`),
  getReturn: (id: string) => api<MaterialReturn>(`/returns/${id}`),
  createReturn: (projectId: string, body: NewReturn) => api<MaterialReturn>(`/projects/${projectId}/returns`, { method: 'POST', body }),
  // receivedLines: on acceptance, what actually arrived per line when less than sent.
  decide: (id: string, decision: 'accepted' | 'rejected', note?: string, receivedLines?: { lineId: string; qtyReceived: number }[]) =>
    api<MaterialReturn>(`/returns/${id}/decision`, { method: 'POST', body: { decision, note, ...(receivedLines?.length ? { receivedLines } : {}) } }),
  warehouses: () => api<WarehouseChoice[]>('/transfer-targets/warehouses'),
  addAttachment: (id: string, picked: PickedFile) => api<MaterialReturn>(`/returns/${id}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  downloadAttachment: (id: string, a: Pick<Attachment, 'id'>) => apiBlob(`/returns/${id}/attachments/${a.id}`),
  printLink: (id: string, kind: 'challan' | 'gatepass') => api<{ url: string }>(`/returns/${id}/print-link/${kind}`),
  usage: (projectId: string) => api<Usage[]>(`/projects/${projectId}/usage`),
  addUsage: (projectId: string, body: NewUsage) => api<Usage>(`/projects/${projectId}/usage`, { method: 'POST', body }),
  counts: (projectId: string) => api<StockCount[]>(`/projects/${projectId}/stock-counts`),
  count: (projectId: string, id: string) => api<StockCount>(`/projects/${projectId}/stock-counts/${id}`),
  addCount: (projectId: string, body: NewStockCount) => api<StockCount>(`/projects/${projectId}/stock-counts`, { method: 'POST', body }),
};
