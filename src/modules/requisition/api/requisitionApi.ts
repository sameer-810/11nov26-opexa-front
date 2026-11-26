import { api, apiBlob } from '../../../shared/api/apiClient';
import type { ApproverOption, Attachment, BalanceRow, NewRequisition, Requisition, TimelineEvent } from '../types';

// A file picked on the phone ({ uri, name, type }) or in the browser (Blob).
export type PickedFile = { name: string; file: Blob | { uri: string; name: string; type: string } };

// Multipart body with one picked file under "file".
export function attachmentForm(picked: PickedFile): FormData {
  const f = new FormData();
  if (typeof Blob !== 'undefined' && picked.file instanceof Blob) f.append('file', picked.file, picked.name);
  // React Native's FormData takes { uri, name, type } for a file on the phone.
  else f.append('file', picked.file as unknown as Blob);
  return f;
}

export const requisitionApi = {
  approvers: (projectId: string) => api<ApproverOption[]>(`/projects/${projectId}/requisition-approvers`),
  balance: (projectId: string) => api<BalanceRow[]>(`/projects/${projectId}/boq-balance`),
  create: (projectId: string, body: NewRequisition) => api<Requisition>(`/projects/${projectId}/requisitions`, { method: 'POST', body }),
  resubmit: (id: string, body: NewRequisition) => api<Requisition>(`/requisitions/${id}`, { method: 'PUT', body }),
  list: (q: { projectId?: string; overBoq?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (q.projectId) params.set('projectId', q.projectId);
    if (q.overBoq) params.set('overBoq', 'true');
    const s = params.toString();
    return api<Requisition[]>(`/requisitions${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api<Requisition>(`/requisitions/${id}`),
  timeline: (id: string) => api<TimelineEvent[]>(`/requisitions/${id}/timeline`),
  cancel: (id: string, reason: string) => api<Requisition>(`/requisitions/${id}/cancel`, { method: 'POST', body: { reason } }),
  addAttachment: (id: string, picked: PickedFile) => api<Requisition>(`/requisitions/${id}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  removeAttachment: (id: string, attachmentId: string) => api<Requisition>(`/requisitions/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
  downloadAttachment: (id: string, a: Pick<Attachment, 'id'>) => apiBlob(`/requisitions/${id}/attachments/${a.id}`),
};
