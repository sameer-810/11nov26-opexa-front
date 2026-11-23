import { api, apiBlob } from '../../shared/api/apiClient';
import type { GstRow } from '../invoice/invoiceApi';

// 4D credit / debit notes, 4G client receipts, ledger and reconciliation.
export type NoteLine = { description: string; hsnSac?: string; unit?: string; qty: number; rate: number; amount?: number; gstRate?: number };
export type Note = {
  id: string; side: 'client' | 'supplier'; kind: 'credit' | 'debit'; number: string | null; label: string; status: 'pending_approval' | 'sent_back' | 'rejected' | 'issued' | 'cancelled';
  noteDate: string; reason: string; invoice: { id: string; number?: string } | null; supplierInvoice: { id: string; number?: string } | null; project: { id: string; code?: string; name?: string } | null;
  party: { name: string; gstin?: string } | null; requestId: string | null; lines: NoteLine[]; gstSummary: GstRow[]; taxable: number; cgst: number; sgst: number; igst: number; total: number; cancelled: { reason: string } | null;
};
export type NoteIn = { side: 'client' | 'supplier'; kind: 'credit' | 'debit'; invoiceId?: string; projectId?: string; supplierInvoiceId?: string; requestId?: string; noteDate: string; reason: string; lines: NoteLine[] };
export type NoteRequest = { id: string; status: 'open' | 'done'; sourceNumber: string; reason: string; suggestedAmount: number; invoice: { id: string; number: string; client: string } | null; project: { code: string; name: string } | null; prefill: Omit<NoteIn, 'noteDate'> };

export type Allocation = { id: string; invoiceId: string; invoiceNumber: string | null; amount: number; at: string };
export type ClientReceipt = { id: string; number: string; clientName: string; projectId: string | null; projectName: string | null; date: string; mode: string; reference: string; amount: number; tds: number; status: 'active' | 'cancelled'; allocations: Allocation[]; allocated: number; onAccount: number; cancelled: { reason: string } | null };
export type OpenInvoice = { id: string; number: string; invoiceDate: string; project: string; total: number; outstanding: number };
export type ReceiptIn = { projectId?: string; clientName?: string; date: string; mode: string; reference?: string; amount: number; tds?: number; allocations?: { invoiceId: string; amount: number }[] };
export type LedgerRow = { date: string; type: string; ref: string; narration: string; debit: number; credit: number; balance: number };
export type Ledger = { client: string | null; opening: number; closing: number; retentionHeld: number; onAccount: number; totals: { debit: number; credit: number }; rows: LedgerRow[] };
export type ReconRow = { invoiceId: string; number: string; project: string; status: string; total: number; credited: number; debited: number; receivedOnInvoice: number; allocated: number; retention: number; advanceRecovery: number; outstanding: number; flags: string[] };
export type Reconciliation = { rows: ReconRow[]; mismatches: number; unallocated: { id: string; number: string; clientName: string; onAccount: number }[]; onAccountNotes: { id: string; number: string; kind: string; total: number }[]; totals: Record<'invoiced' | 'credited' | 'debited' | 'received' | 'outstanding' | 'onAccount', number> };

const q = (o: Record<string, string | undefined>) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&');

export const notesApi = {
  list: (filter: { invoiceId?: string; side?: string } = {}) => api<Note[]>(`/notes?${q(filter)}`),
  create: (body: NoteIn) => api<Note>('/notes', { method: 'POST', body }),
  cancel: (id: string, reason: string) => api<Note>(`/notes/${id}/cancel`, { method: 'POST', body: { reason } }),
  requests: () => api<NoteRequest[]>('/notes/requests'),
  printLink: (id: string) => api<{ url: string }>(`/notes/${id}/print-link`),
};

export const receiptsApi = {
  list: (filter: { client?: string; projectId?: string } = {}) => api<ClientReceipt[]>(`/client-receipts?${q(filter)}`),
  create: (body: ReceiptIn) => api<ClientReceipt>('/client-receipts', { method: 'POST', body }),
  allocate: (id: string, allocations: { invoiceId: string; amount: number }[]) => api<ClientReceipt>(`/client-receipts/${id}/allocate`, { method: 'POST', body: { allocations } }),
  cancel: (id: string, reason: string) => api<ClientReceipt>(`/client-receipts/${id}/cancel`, { method: 'POST', body: { reason } }),
  openInvoices: (filter: { client?: string; projectId?: string }) => api<OpenInvoice[]>(`/client-receipts/open-invoices?${q(filter)}`),
  ledger: (filter: { client?: string; projectId?: string; from?: string; to?: string }) => api<Ledger>(`/client-receipts/ledger?${q(filter)}`),
  ledgerXlsx: (filter: { client?: string; projectId?: string; from?: string; to?: string }) => apiBlob(`/client-receipts/ledger/export?${q(filter)}`),
  reconciliation: (filter: { client?: string; projectId?: string }) => api<Reconciliation>(`/client-receipts/reconciliation?${q(filter)}`),
};
