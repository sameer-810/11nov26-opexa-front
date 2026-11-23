import { api, apiBlob } from '../../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../../requisition/api/requisitionApi';
import type { Attachment } from '../../requisition/types';
import type { DeliveryChallan, NewChallan } from '../types';

export const challanApi = {
  list: (q: { projectId?: string; requisitionId?: string; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (q.projectId) params.set('projectId', q.projectId);
    if (q.requisitionId) params.set('requisitionId', q.requisitionId);
    if (q.q) params.set('q', q.q);
    const s = params.toString();
    return api<DeliveryChallan[]>(`/delivery-challans${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api<DeliveryChallan>(`/delivery-challans/${id}`),
  create: (body: NewChallan) => api<DeliveryChallan>('/delivery-challans', { method: 'POST', body }),
  cancel: (id: string, reason: string) => api<DeliveryChallan>(`/delivery-challans/${id}/cancel`, { method: 'POST', body: { reason } }),
  printLink: (id: string) => api<{ url: string }>(`/delivery-challans/${id}/print-link`),
  addAttachment: (id: string, picked: PickedFile) => api<DeliveryChallan>(`/delivery-challans/${id}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  downloadAttachment: (id: string, a: Pick<Attachment, 'id'>) => apiBlob(`/delivery-challans/${id}/attachments/${a.id}`),
};
