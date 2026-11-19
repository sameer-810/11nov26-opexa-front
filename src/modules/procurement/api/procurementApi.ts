import { api } from '../../../shared/api/apiClient';
import type {
  BoardRow, Comparison, Dashboard, FollowUp, NewFollowUp, NewQuote, NewRfq, NewSupplierInvoice, PendingQuantities, ProcurementPo, Quotation, RevisionInput,
  Rfq, Selection, SupplierInvoice, SupplierLink,
} from '../types';

const qs = (q: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  return p ? `?${p}` : '';
};

export const procurementApi = {
  dashboard: (q: Record<string, string | undefined> = {}) => api<Dashboard>(`/procurement/dashboard${qs(q)}`),
  pendingQuantities: (q: Record<string, string | undefined> = {}) => api<PendingQuantities>(`/procurement/pending-quantities${qs(q)}`),

  rfqs: (q: { status?: string; requisitionId?: string } = {}) => api<Rfq[]>(`/procurement/rfqs${qs(q)}`),
  rfq: (id: string) => api<Rfq>(`/procurement/rfqs/${id}`),
  createRfq: (body: NewRfq) => api<Rfq>('/procurement/rfqs', { method: 'POST', body }),
  updateRfq: (id: string, body: Partial<NewRfq>) => api<Rfq>(`/procurement/rfqs/${id}`, { method: 'PATCH', body }),
  publishRfq: (id: string) => api<Rfq>(`/procurement/rfqs/${id}/publish`, { method: 'POST' }),
  closeRfq: (id: string) => api<Rfq>(`/procurement/rfqs/${id}/close`, { method: 'POST' }),
  cancelRfq: (id: string, reason: string) => api<Rfq>(`/procurement/rfqs/${id}/cancel`, { method: 'POST', body: { reason } }),
  supplierLink: (id: string, vendorId: string) => api<SupplierLink>(`/procurement/rfqs/${id}/suppliers`, { method: 'POST', body: { vendorId } }),
  decline: (id: string, vendorId: string, reason: string) => api<{ declined: boolean }>(`/procurement/rfqs/${id}/suppliers/${vendorId}/decline`, { method: 'POST', body: { reason } }),
  addQuote: (id: string, body: NewQuote) => api<Quotation>(`/procurement/rfqs/${id}/quotations`, { method: 'POST', body }),
  comparison: (id: string) => api<Comparison>(`/procurement/rfqs/${id}/comparison`),
  saveEvaluation: (id: string, remarks: string) => api<{ evaluationRemarks: string }>(`/procurement/rfqs/${id}/evaluation`, { method: 'PUT', body: { remarks } }),

  selections: (q: { status?: string; rfqId?: string } = {}) => api<Selection[]>(`/procurement/selections${qs(q)}`),
  selection: (id: string) => api<Selection>(`/procurement/selections/${id}`),
  select: (rfqId: string, body: { justification: string; allocations: { requisitionLineId: string; quoteId: string; qty: number }[] }) => api<Selection>(`/procurement/rfqs/${rfqId}/selections`, { method: 'POST', body }),
  generatePos: (id: string) => api<Selection>(`/procurement/selections/${id}/purchase-orders`, { method: 'POST', body: {} }),
  cancelSelection: (id: string, reason: string) => api<Selection>(`/procurement/selections/${id}/cancel`, { method: 'POST', body: { reason } }),

  po: (id: string) => api<ProcurementPo>(`/procurement/purchase-orders/${id}`),
  revise: (id: string, body: RevisionInput) => api<ProcurementPo>(`/procurement/purchase-orders/${id}/revisions`, { method: 'POST', body }),
  followUpBoard: (q: { vendorId?: string; overdue?: string } = {}) => api<BoardRow[]>(`/procurement/follow-ups${qs(q)}`),
  addFollowUp: (body: NewFollowUp) => api<FollowUp>('/procurement/follow-ups', { method: 'POST', body }),
  updateFollowUp: (id: string, body: Partial<NewFollowUp>) => api<FollowUp>(`/procurement/follow-ups/${id}`, { method: 'PATCH', body }),

  invoices: (q: { status?: string; purchaseOrderId?: string } = {}) => api<SupplierInvoice[]>(`/procurement/supplier-invoices${qs(q)}`),
  invoice: (id: string) => api<SupplierInvoice>(`/procurement/supplier-invoices/${id}`),
  createInvoice: (body: NewSupplierInvoice) => api<SupplierInvoice>('/procurement/supplier-invoices', { method: 'POST', body }),
  invoiceAction: (id: string, action: 'start' | 'rematch' | 'approve' | 'reject' | 'cancel' | 'submit', remarks?: string) => api<SupplierInvoice>(`/procurement/supplier-invoices/${id}/actions`, { method: 'POST', body: { action, remarks } }),

  printLink: (kind: 'rfq' | 'comparison' | 'po', id: string) => api<{ url: string }>(`/procurement/print-link/${kind}/${id}`),
};
