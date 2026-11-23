import { Platform } from 'react-native';
import { api } from '../../../shared/api/apiClient';

// Q29: project completion (approval PM -> Director) before the handover can be submitted.
export type CompletionStatus = 'not_requested' | 'pending' | 'approved' | 'rejected' | 'sent_back';
export type Completion = { status: CompletionStatus; note: string; requestedAt: string | null; completedAt: string | null; approvalRequestId: string | null };
export type ChecklistStatus = 'pending' | 'done' | 'na';
export type ChecklistItem = { key: string; label: string; required: boolean; status: ChecklistStatus; note: string; documentId: string | null };
export type HandoverUnit = { id: string; workOrderItemId: string; name: string; brand?: string; model?: string; serialNo: string; location?: string; warrantyMonths: number; pmEveryMonths: number; verified: boolean; assetId: string | null; installedOn: string | null };
export type HandoverFile = { id: string; label: string | null; name: string; contentType: string; size: number };
export type Handover = { status: 'draft' | 'submitted' | 'accepted' | 'returned'; handoverDate: string; returnReason: string | null; notes: string; equipment: HandoverUnit[]; checklist: ChecklistItem[]; files: HandoverFile[] };
export type UnitInput = { workOrderItemId: string; name: string; serialNo: string; location?: string; warrantyMonths: number; pmEveryMonths?: number; installedOn?: string };
export type HandoverInput = { handoverDate: string; notes?: string; equipment: UnitInput[]; checklist: { key: string; status: ChecklistStatus }[] };

// Q30: AMC contracts.
export type AmcSchedule = { id: string; dueDate: string; amount: number; label: string; invoiceId: string | null; due: boolean; cancelled: boolean };
export type Amc = {
  id: string; projectId: string; number: string; clientName: string; startDate: string; endDate: string; contractValue: number; status: 'active' | 'expired' | 'renewed' | 'cancelled';
  daysToEnd: number; assets: number; revenue: number; expenses: number; profit: number; marginPct: number | null; visitsPerYear: number;
  visits: { preventive: number; complaints: number; open: number }; schedule: AmcSchedule[];
  customerId: string | null; technicianId: string | null; partsIncluded: boolean; nextVisitDate: string | null;
  cancellation: { reason: string; effectiveDate: string; at: string } | null;
};
export type AmcHistory = {
  plan: { date: string; status: 'raised' | 'past' | 'upcoming' }[];
  tickets: { id: string; number: string; kind: 'complaint' | 'preventive'; title: string; status: string; createdAt: string; technician: string | null; charge: number; asset: { name: string; serialNo: string; location: string } | null; visits: { at: string; byName: string; note: string; partsUsed: string; charge: number | null }[] }[];
  totals: { preventive: number; complaints: number; open: number; visits: number; partsUsed: number; charges: number; expenses: Record<string, number> };
};
export type NewAmc = { projectId: string; assetIds: string[]; startDate: string; endDate: string; contractValue: number; visitsPerYear: number; technicianId?: string; partsIncluded: boolean };

export type Customer = { id: string; name: string; gstin: string; address: string; contacts: { name: string; phone: string; email: string; designation: string }[]; assets?: number; activeAmcs?: number };
export type CustomerDetail = Customer & { assets: number; projects: { id: string; code: string; name: string; status: string }[]; amcs: { id: string; number: string; status: string; startDate: string; endDate: string; contractValue: number }[] };
export type CustomerInput = { name: string; gstin?: string; address?: string; contacts?: { name?: string; phone?: string; email?: string }[] };

const P = (id: string) => `/projects/${id}`;
export type PickedFile = { uri: string; name: string; mimeType?: string; file?: File };

export const handoverApi = {
  completion: (id: string) => api<Completion>(`${P(id)}/completion`),
  markComplete: (id: string, note: string) => api<Completion>(`${P(id)}/completion`, { method: 'POST', body: note ? { note } : {} }),
  get: (id: string) => api<Handover | null>(`${P(id)}/handover`),
  save: (id: string, body: HandoverInput) => api<Handover>(`${P(id)}/handover`, { method: 'PUT', body }),
  submit: (id: string) => api<Handover>(`${P(id)}/handover/submit`, { method: 'POST' }),
  decide: (id: string, body: { action: 'accept' | 'return'; verifiedSerials?: string[]; reason?: string }) => api<Handover>(`${P(id)}/handover/decision`, { method: 'POST', body }),
  upload: (id: string, a: PickedFile, checklistKey?: string) => {
    const f = new FormData();
    if (Platform.OS === 'web' && a.file) f.append('file', a.file, a.name);
    else f.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf' } as unknown as Blob);
    if (checklistKey) f.append('checklistKey', checklistKey);
    return api<HandoverFile>(`${P(id)}/handover/documents`, { method: 'POST', body: f });
  },
  fileUrl: (id: string, docId: string) => `${P(id)}/handover/documents/${docId}`,
};

export const amcApi = {
  list: () => api<{ rows: Amc[] }>('/amc'),
  create: (body: NewAmc) => api<Amc>('/amc', { method: 'POST', body }),
  update: (id: string, body: { technicianId?: string | null; partsIncluded?: boolean }) => api<Amc>(`/amc/${id}`, { method: 'PATCH', body }),
  cancel: (id: string, body: { reason: string; effectiveDate: string }) => api<Amc>(`/amc/${id}/cancel`, { method: 'POST', body }),
  history: (id: string) => api<AmcHistory>(`/amc/${id}/history`),
  bill: (id: string, scheduleId: string) => api<{ invoiceId: string }>(`/amc/${id}/schedule/${scheduleId}/invoice`, { method: 'POST' }),
  expense: (id: string, body: { date: string; category: 'parts'; amount: number }) => api<Amc>(`/amc/${id}/expenses`, { method: 'POST', body }),
  renew: (id: string, body: { endDate: string; contractValue: number }) => api<Amc>(`/amc/${id}/renew`, { method: 'POST', body }),
};

export const customerApi = {
  list: (q = '') => api<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  get: (id: string) => api<CustomerDetail>(`/customers/${id}`),
  create: (body: CustomerInput) => api<CustomerDetail>('/customers', { method: 'POST', body }),
  update: (id: string, body: Partial<CustomerInput>) => api<CustomerDetail>(`/customers/${id}`, { method: 'PATCH', body }),
  syncFromProjects: () => api<{ created: number }>('/customers/sync-from-projects', { method: 'POST' }),
};

export const COMPLETION_LABEL: Record<CompletionStatus, string> = { not_requested: 'Not marked complete', pending: 'Completion waiting for approval', approved: 'Project complete', rejected: 'Completion rejected', sent_back: 'Completion sent back' };
export const COMPLETION_TONE = { not_requested: 'neutral', pending: 'warning', approved: 'success', rejected: 'danger', sent_back: 'danger' } as const;
