import { api } from '../../shared/api/apiClient';

export type Cat = { key: string; estimate: number; actual: number; committed: number; variance: number; forecast: number };
export type Financials = {
  revenue: { contract: number; billed: number; workDone: number }; estimate: { cost: number; margin: number; marginPct: number | null };
  actual: { cost: number }; committed: { cost: number }; consumedMaterial: number; materialAtSite: number; supplierInvoiced: number;
  forecast: { cost: number; margin: number; marginPct: number | null }; marginOnBilled: { value: number; pct: number | null }; categories: Cat[]; overrun: boolean;
  lines: { workOrderItemId: string; serialNo: string; description: string; tendered: boolean; revenue: number; estimatedMaterial: number; actualMaterial: number; packageMaterial: number; materialVariance: number }[];
  notes: string[];
};
export type EstimateLine = { workOrderItemId: string; serialNo: string; description: string; unit: string; quantity: number; rate: number; tendered: boolean; perUnit: Record<string, number>; totalCost: number; revenue: number; margin: number; marginPct: number | null };
export type Estimate = { revenue: number; cost: number; margin: number; marginPct: number | null; overheadEstimate: number; costAlertPct: number; boqLocked: boolean; boqRevision: number; lines: EstimateLine[] };
export type RegRow = { workOrderItemId: string; serialNo: string; description: string; unit: string; tendered: boolean; boqQty: number; executed: number; billed: number; excess: number; excessValue: number; additionalValue: number; clientApprovalRef: string | null; status: string };
export type Regularisation = { boqRevision: number; summary: { excessLines: number; excessValue: number; additionalLines: number; additionalValue: number; unconfirmedAdditional: number }; rows: RegRow[] };
export type Revision = { id: string; revisionNo: number; reason: string; status: string; createdAt: string; changes: { action: string; before: Record<string, unknown> | null; after: Record<string, unknown> }[] };

const base = (id: string) => `/projects/${id}`;
export const projectFinanceApi = {
  financials: (id: string) => api<Financials>(`${base(id)}/financials`),
  estimate: (id: string) => api<Estimate>(`${base(id)}/estimate`),
  saveEstimate: (id: string, body: { overheadEstimate?: number; costAlertPct?: number; lines?: { workOrderItemId: string; [k: string]: number | string }[] }) => api<Estimate>(`${base(id)}/estimate`, { method: 'PUT', body }),
  lock: (id: string) => api<{ boqLocked: boolean }>(`${base(id)}/boq/lock`, { method: 'POST' }),
  revisions: (id: string) => api<Revision[]>(`${base(id)}/boq-revisions`),
  revise: (id: string, body: { reason: string; changes: unknown[] }) => api<Revision>(`${base(id)}/boq-revisions`, { method: 'POST', body }),
  addWork: (id: string, body: { serialNo: string; description: string; unit: string; quantity: number; rate: number; reason: string }) => api<unknown>(`${base(id)}/additional-work`, { method: 'POST', body }),
  regularise: (id: string, itemId: string, clientApprovalRef: string) => api<unknown>(`${base(id)}/additional-work/${itemId}/regularise`, { method: 'POST', body: { clientApprovalRef } }),
  regularisation: (id: string) => api<Regularisation>(`${base(id)}/boq-regularisation`),
};
