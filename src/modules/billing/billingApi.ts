import { api, apiBlob } from '../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../requisition/api/requisitionApi';
import type { Attachment } from '../requisition/types';

export type Stage = 'advance' | 'high_side_delivery' | 'installation' | 'testing_commissioning' | 'handover' | 'custom';
export type SlabBase = 'contract_value' | 'high_side_value';
// 4A: the slab's completion record (null until recorded).
export type Completion = { completedOn: string; at: string; note: string; documentIds: string[]; linkedTotalQty: number | null; linkedDoneQty: number | null };
export type Milestone = { id: string; name: string; stage: Stage; basis: 'percent' | 'fixed'; percent: number; fixedAmount: number; amount: number; billed: number; linkedItemIds: string[]; completion?: Completion | null };
export type Plan = { id: string; status: 'draft' | 'approved'; retentionPct: number; slabBase?: SlabBase; baseValue?: number; highSideValue: number; highSideItemIds?: string[]; milestones: Milestone[] };
export type PositionMilestone = {
  id: string; name: string; stage?: Stage; contractPct?: number | null; amount: number; billed: number; unbilled: number; computedAmount?: number; eligible?: boolean; completion?: Completion | null; remainingObligation?: number;
  linkedTotalQty: number; linkedDoneQty: number; pendingQty: number; deliveredPct: number | null; billedAheadOfDelivery: boolean; pending: { serialNo: string; description: string; pendingQty: number; unit: string }[];
};
export type PlanMilestoneIn = { id?: string; name: string; stage: Stage; basis: 'percent' | 'fixed'; percent: number; fixedAmount: number; linkedItemIds: string[] };
export type LowSide = {
  workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; variationQty: number | null; allowedQty: number; executedQty: number; measuredQty: number;
  clientVerifiedQty: number; approvedQty: number; billedQty: number; unbilledApprovedQty: number; awaitingClient: number; overBoq: boolean; overBoqQty: number; overBoqHint: string | null; remainingObligation?: number;
};
export type Position = { planStatus: string | null; slabBase?: SlabBase; baseValue?: number; highSideValue: number; remainingObligation?: number; milestones: PositionMilestone[]; lowSide: LowSide[] };
export type SheetRow = { id: string; description: string; nos: number; length: number | null; breadth: number | null; height: number | null; qty: number; correctedQty: number | null; correctionNote: string; deduct: boolean; formula: string };
export type CorrectionRole = 'site' | 'client_engineer' | 'pm';
export type Correction = { rowId: string; oldQty: number; newQty: number; byName: string; role: CorrectionRole; at: string | null; reason: string; legacy: boolean };
export type Sheet = {
  id: string; number: string; workOrderItemId: string; unit: string | null; zone: string; department: string; floor: string; measuredOn: string; status: string; measuredQty: number; finalQty: number;
  clientEngineer: string; invoiceId: string | null; rows: SheetRow[]; corrections: Correction[]; attachments: Attachment[]; warning?: string | null;
};
export type NewRow = { description?: string; nos?: number; length?: number; breadth?: number; height?: number; deduct?: boolean; formula?: string };
type SheetAction =
  | { action: 'submit' | 'approve' | 'reject'; note?: string }
  | { action: 'client_verify'; clientEngineer: string; corrections?: { rowId: string; correctedQty: number; reason?: string }[] }
  | { action: 'correct'; role: CorrectionRole; clientEngineer?: string; corrections: { rowId: string; correctedQty: number; reason: string }[] };
export type Receivable = { invoiceId: string; number: string; project: string; client: string; invoiceDate: string; kind: string; total: number; retention: number; received: number; tds: number; outstanding: number; ageDays: number; bucket: string };

const P = (id: string) => `/projects/${id}`;
export const billingApi = {
  plan: (id: string) => api<Plan | null>(`${P(id)}/billing-plan`),
  savePlan: (id: string, body: { retentionPct?: number; slabBase?: SlabBase; highSideItemIds?: string[]; milestones: PlanMilestoneIn[]; reason?: string }) => api<Plan>(`${P(id)}/billing-plan`, { method: 'PUT', body }),
  approvePlan: (id: string) => api<Plan>(`${P(id)}/billing-plan/approve`, { method: 'POST' }),
  position: (id: string) => api<Position>(`${P(id)}/billing-position`),
  milestoneInvoice: (id: string, body: { milestoneId: string; invoiceDate: string; amount?: number; reason?: string }) => api<{ id: string }>(`${P(id)}/milestone-invoices`, { method: 'POST', body }),
  completeSlab: (id: string, milestoneId: string, body: { completedOn: string; note?: string }) => api<Completion>(`${P(id)}/billing-plan/milestones/${milestoneId}/completion`, { method: 'POST', body }),
  addSlabEvidence: (id: string, milestoneId: string, picked: PickedFile) => api<Completion>(`${P(id)}/billing-plan/milestones/${milestoneId}/completion/files`, { method: 'POST', body: attachmentForm(picked) }),
  sheets: (id: string) => api<Sheet[]>(`${P(id)}/measurement-sheets`),
  createSheet: (id: string, body: { workOrderItemId: string; zone?: string; department?: string; floor?: string; measuredOn: string; rows: NewRow[] }) => api<Sheet>(`${P(id)}/measurement-sheets`, { method: 'POST', body }),
  sheetAction: (id: string, sheetId: string, body: SheetAction) => api<Sheet>(`${P(id)}/measurement-sheets/${sheetId}/action`, { method: 'POST', body }),
  sheetPrintLink: (id: string, sheetId: string) => api<{ url: string }>(`${P(id)}/measurement-sheets/${sheetId}/print-link`),
  addSheetFile: (id: string, sheetId: string, picked: PickedFile) => api<Sheet>(`${P(id)}/measurement-sheets/${sheetId}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  sheetFile: (id: string, sheetId: string, a: Pick<Attachment, 'id'>) => apiBlob(`${P(id)}/measurement-sheets/${sheetId}/attachments/${a.id}`),
  measurementInvoice: (id: string, sheetIds: string[], invoiceDate: string) => api<{ id: string }>(`${P(id)}/measurement-invoices`, { method: 'POST', body: { sheetIds, invoiceDate } }),
  receivables: (projectId?: string) => api<{ rows: Receivable[]; total: number; byBucket: { bucket: string; amount: number }[] }>(`/billing/receivables${projectId ? `?projectId=${projectId}` : ''}`),
  receipt: (invoiceId: string, body: { amount: number; tds?: number; date: string; reference?: string }) => api<unknown>(`/billing/invoices/${invoiceId}/receipts`, { method: 'POST', body }),
};
