import { api, apiBlob } from '../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../requisition/api/requisitionApi';
import type { Attachment } from '../requisition/types';

export type Cat = { key: string; estimate: number; actual: number; committed: number; variance: number; forecast: number };
export type Financials = {
  revenue: { contract: number; billed: number; workDone: number }; estimate: { cost: number; margin: number; marginPct: number | null };
  actual: { cost: number }; committed: { cost: number }; consumedMaterial: number; materialAtSite: number; supplierInvoiced: number;
  actualMargin?: { value: number; pct: number | null };
  forecast: { cost: number; margin: number; marginPct: number | null }; marginOnBilled: { value: number; pct: number | null }; categories: Cat[]; overrun: boolean;
  lines: { workOrderItemId: string; serialNo: string; description: string; tendered: boolean; revenue: number; estimatedMaterial: number; actualMaterial: number; packageMaterial: number; materialVariance: number }[];
  notes: string[];
};
// Q22: per-unit categories on BOQ lines; project-level lump sums for what is not per line.
export const LINE_CATS = ['material', 'installation', 'subcontract', 'labour', 'transport', 'equipment', 'other'] as const;
export const LUMP_CATS = ['material', 'installation', 'subcontract', 'labour', 'transport', 'other'] as const;
export type LumpCat = (typeof LUMP_CATS)[number];
export type LumpSum = Record<LumpCat, number>;
export type EstimateLine = { workOrderItemId: string; serialNo: string; description: string; unit: string; quantity: number; rate: number; tendered: boolean; perUnit: Record<string, number>; totalCost: number; revenue: number; margin: number; marginPct: number | null };
export type Estimate = {
  revenue: number; cost: number; margin: number; marginPct: number | null; overheadEstimate: number; costAlertPct: number; boqLocked: boolean; boqRevision: number; lines: EstimateLine[];
  contractValue?: number | null; lumpSum?: LumpSum; lumpTotal?: number;
};
export type RegRow = {
  workOrderItemId: string; serialNo: string; description: string; unit: string; tendered: boolean; boqQty: number; executed: number; billed: number; excess: number; excessValue: number; additionalValue: number; clientApprovalRef: string | null; status: string;
  billedValue?: number; unbilledQty?: number; unbilledValue?: number; changeRequest?: string | null; documents?: number;
};
export type Regularisation = { boqRevision: number; summary: { excessLines: number; excessValue: number; additionalLines: number; additionalValue: number; unconfirmedAdditional: number; additionalBilled?: number; additionalUnbilled?: number }; rows: RegRow[] };
export type Revision = { id: string; revisionNo: number; reason: string; status: string; createdAt: string; changes: { action: string; before: Record<string, unknown> | null; after: Record<string, unknown> }[] };

export type CrStatus = 'raised' | 'client_approved' | 'rejected' | 'cancelled' | 'closed';
export type ChangeRequest = {
  id: string; number: string; description: string; clientReference: string; requestedBy: string; requestedOn: string; reason: string; status: CrStatus; value: number;
  documents: Attachment[]; items: { id: string; serialNo: string; description: string; unit: string; quantity: number; rate: number; value: number; status: string | null }[];
};
export type ExtraMaterial = {
  materialId: string; name: string; unit: string; requested: number; billableRequested: number; ordered: number; orderedValue: number; received: number; issuedToSubcontractor: number; consumed: number;
  cost: number; billableCost: number; billable: 'billable' | 'partly_billable' | 'non_billable'; extraWork: string[];
};
export type ExtraMaterialReport = { totals: { cost: number; billableCost: number; nonBillableCost: number }; lines: { workOrderItemId: string; serialNo: string; description: string; cost: number; billableCost: number; materials: ExtraMaterial[] }[] };
export type ProfitLine = {
  workOrderItemId: string; serialNo: string; description: string; tendered: boolean; revenue: number; estimatedCost: number; actualCost: number; billed: number;
  actual: { material: number; extraMaterial: number; subcontract: number; allocated: number }; forecastMargin: number; forecastMarginPct: number | null; overrun: boolean; overrunBy: number;
};
export type BoqProfit = { lines: ProfitLine[]; totals: { revenue: number; estimatedCost: number; actualCost: number; billed: number; forecastMargin: number; forecastMarginPct: number | null; overrunLines: number }; rule: string };

const base = (id: string) => `/projects/${id}`;
export const projectFinanceApi = {
  financials: (id: string) => api<Financials>(`${base(id)}/financials`),
  estimate: (id: string) => api<Estimate>(`${base(id)}/estimate`),
  saveEstimate: (id: string, body: { overheadEstimate?: number; costAlertPct?: number; estimateLumpSum?: Partial<LumpSum>; lines?: { workOrderItemId: string; [k: string]: number | string }[] }) => api<Estimate>(`${base(id)}/estimate`, { method: 'PUT', body }),
  lock: (id: string) => api<{ boqLocked: boolean }>(`${base(id)}/boq/lock`, { method: 'POST' }),
  revisions: (id: string) => api<Revision[]>(`${base(id)}/boq-revisions`),
  revise: (id: string, body: { reason: string; changes: unknown[] }) => api<Revision>(`${base(id)}/boq-revisions`, { method: 'POST', body }),
  addWork: (id: string, body: { serialNo: string; description: string; unit: string; quantity: number; rate: number; reason: string; changeRequestId?: string }) => api<unknown>(`${base(id)}/additional-work`, { method: 'POST', body }),
  regularise: (id: string, itemId: string, clientApprovalRef: string) => api<unknown>(`${base(id)}/additional-work/${itemId}/regularise`, { method: 'POST', body: { clientApprovalRef } }),
  regularisation: (id: string) => api<Regularisation>(`${base(id)}/boq-regularisation`),
  regularisationExcel: (id: string) => apiBlob(`${base(id)}/boq-regularisation.xlsx`),
  itemDocuments: (id: string, itemId: string) => api<Attachment[]>(`${base(id)}/additional-work/${itemId}/documents`),
  addItemDocument: (id: string, itemId: string, picked: PickedFile) => api<Attachment[]>(`${base(id)}/additional-work/${itemId}/documents`, { method: 'POST', body: attachmentForm(picked) }),
  itemDocument: (id: string, itemId: string, a: Pick<Attachment, 'id'>) => apiBlob(`${base(id)}/additional-work/${itemId}/documents/${a.id}`),
  changeRequests: (id: string) => api<ChangeRequest[]>(`${base(id)}/change-requests`),
  createChangeRequest: (id: string, body: { description: string; requestedBy: string; requestedOn: string; clientReference?: string; reason?: string }) => api<ChangeRequest>(`${base(id)}/change-requests`, { method: 'POST', body }),
  setChangeRequestStatus: (id: string, crId: string, body: { status: Exclude<CrStatus, 'raised'>; clientReference?: string; note?: string }) => api<ChangeRequest>(`${base(id)}/change-requests/${crId}/status`, { method: 'POST', body }),
  addChangeRequestDocument: (id: string, crId: string, picked: PickedFile) => api<ChangeRequest>(`${base(id)}/change-requests/${crId}/documents`, { method: 'POST', body: attachmentForm(picked) }),
  changeRequestDocument: (id: string, crId: string, a: Pick<Attachment, 'id'>) => apiBlob(`${base(id)}/change-requests/${crId}/documents/${a.id}`),
  extraMaterials: (id: string) => api<ExtraMaterialReport>(`${base(id)}/extra-materials`),
  extraMaterialsExcel: (id: string) => apiBlob(`${base(id)}/extra-materials.xlsx`),
  boqProfitability: (id: string) => api<BoqProfit>(`${base(id)}/boq-profitability`),
  boqProfitabilityExcel: (id: string) => apiBlob(`${base(id)}/boq-profitability.xlsx`),
};
