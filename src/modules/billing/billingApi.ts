import { api } from '../../shared/api/apiClient';

export type Milestone = { id: string; name: string; stage: string; basis: 'percent' | 'fixed'; percent: number; fixedAmount: number; amount: number; billed: number; linkedItemIds: string[] };
export type Plan = { id: string; status: 'draft' | 'approved'; retentionPct: number; highSideValue: number; milestones: Milestone[] };
export type PositionMilestone = { id: string; name: string; amount: number; billed: number; unbilled: number; linkedTotalQty: number; linkedDoneQty: number; pendingQty: number; deliveredPct: number | null; billedAheadOfDelivery: boolean; pending: { serialNo: string; description: string; pendingQty: number; unit: string }[] };
export type LowSide = { workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; variationQty: number | null; executedQty: number; measuredQty: number; approvedQty: number; billedQty: number; unbilledApprovedQty: number; awaitingClient: number };
export type Position = { planStatus: string | null; highSideValue: number; milestones: PositionMilestone[]; lowSide: LowSide[] };
export type SheetRow = { id: string; description: string; nos: number; length: number | null; breadth: number | null; height: number | null; qty: number; correctedQty: number | null; correctionNote: string };
export type Sheet = { id: string; number: string; workOrderItemId: string; zone: string; department: string; measuredOn: string; status: string; measuredQty: number; finalQty: number; clientEngineer: string; invoiceId: string | null; rows: SheetRow[] };
export type Receivable = { invoiceId: string; number: string; project: string; client: string; invoiceDate: string; kind: string; total: number; retention: number; received: number; tds: number; outstanding: number; ageDays: number; bucket: string };

const P = (id: string) => `/projects/${id}`;
export const billingApi = {
  plan: (id: string) => api<Plan | null>(`${P(id)}/billing-plan`),
  savePlan: (id: string, body: { retentionPct?: number; highSideItemIds?: string[]; milestones: Omit<Milestone, 'id' | 'amount' | 'billed' | 'stage'>[]; reason?: string }) => api<Plan>(`${P(id)}/billing-plan`, { method: 'PUT', body }),
  approvePlan: (id: string) => api<Plan>(`${P(id)}/billing-plan/approve`, { method: 'POST' }),
  position: (id: string) => api<Position>(`${P(id)}/billing-position`),
  milestoneInvoice: (id: string, body: { milestoneId: string; invoiceDate: string; amount?: number }) => api<{ id: string }>(`${P(id)}/milestone-invoices`, { method: 'POST', body }),
  sheets: (id: string) => api<Sheet[]>(`${P(id)}/measurement-sheets`),
  createSheet: (id: string, body: { workOrderItemId: string; zone?: string; department?: string; measuredOn: string; rows: Partial<SheetRow>[] }) => api<Sheet>(`${P(id)}/measurement-sheets`, { method: 'POST', body }),
  sheetAction: (id: string, sheetId: string, body: { action: 'submit' | 'client_verify' | 'approve' | 'reject'; clientEngineer?: string; corrections?: { rowId: string; correctedQty: number }[] }) => api<Sheet>(`${P(id)}/measurement-sheets/${sheetId}/action`, { method: 'POST', body }),
  measurementInvoice: (id: string, sheetIds: string[], invoiceDate: string) => api<{ id: string }>(`${P(id)}/measurement-invoices`, { method: 'POST', body: { sheetIds, invoiceDate } }),
  receivables: (projectId?: string) => api<{ rows: Receivable[]; total: number; byBucket: { bucket: string; amount: number }[] }>(`/billing/receivables${projectId ? `?projectId=${projectId}` : ''}`),
  receipt: (invoiceId: string, body: { amount: number; tds?: number; date: string; reference?: string }) => api<unknown>(`/billing/invoices/${invoiceId}/receipts`, { method: 'POST', body }),
};
