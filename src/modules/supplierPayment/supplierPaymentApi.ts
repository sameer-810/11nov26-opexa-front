import { api, apiBlob } from '../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../requisition/api/requisitionApi';
import { can, PERMS } from '../../shared/permissions';
import type { User } from '../auth/types';

// Supplier payments and payables (Q5, 4X). Accounts record and pay; buyers can follow what is owed.
export type SupplierPaymentMode = 'bank' | 'cheque' | 'upi' | 'cash';
export type SupplierPaymentStatus = 'draft' | 'submitted' | 'sent_back' | 'rejected' | 'approved' | 'paid' | 'cancelled';
export type Allocation = { supplierInvoiceId: string; invoiceNumber: string | null; invoiceDate: string | null; invoiceTotal: number | null; amount: number; adjustedAt: string | null };
export type SupplierPayment = {
  id: string; number: string; status: SupplierPaymentStatus; vendor: { id: string; name: string; code: string | null } | null;
  date: string; mode: SupplierPaymentMode; reference: string; amount: number; tds: number; gross: number; allocations: Allocation[]; allocated: number;
  onAccount: number; isAdvance: boolean; remarks: string; reviewComment: string; approvalRequestId: string | null;
  submittedAt: string | null; approvedAt: string | null; paidAt: string | null;
  cancelled: { reason: string; at: string; fromStatus: string; tallyReversedAt: string | null } | null;
  attachments: { id: string; name: string; contentType: string; size: number; uploadedAt: string }[]; createdAt: string;
};
export type PaymentInput = {
  vendorId: string; date: string; mode: SupplierPaymentMode; reference?: string; amount: number; tds?: number;
  allocations: { supplierInvoiceId: string; amount: number }[]; remarks?: string;
};
export type OpenInvoice = {
  id: string; number: string; invoiceDate: string; dueDate: string; purchaseOrderId: string; vendorId: string; vendorName: string | null;
  total: number; payableCap: number; heldForShortDelivery: number; inProcess: number; settled: number; outstanding: number; payableNow: number; daysOverdue: number;
};
export type Ageing = { notDue: number; d0_30: number; d31_60: number; d61_90: number; d90plus: number };
export type VendorPayable = {
  vendorId: string; vendorName: string | null; termsDays: number; invoiced: number; paid: number; tds: number; advanceUnadjusted: number;
  outstanding: number; overdue: number; netPayable: number; ageing: Ageing;
};
export type Payables = {
  asOf: string; basis: 'invoice' | 'due'; vendors: VendorPayable[];
  totals: Omit<VendorPayable, 'vendorId' | 'vendorName' | 'termsDays'>; overdue: OpenInvoice[];
};
export type LedgerRow = { date: string; type: 'invoice' | 'payment' | 'tds'; id: string; ref: string; narration: string; credit: number; debit: number; balance: number };
export type SupplierLedger = {
  vendor: { id: string; name: string; code: string | null; gstin: string | null }; from: string | null; to: string | null;
  opening: number; closing: number; totals: { credit: number; debit: number }; advanceUnadjusted: number; rows: LedgerRow[];
};

export const MODE_LABEL: Record<SupplierPaymentMode, string> = { bank: 'Bank transfer', cheque: 'Cheque', upi: 'UPI', cash: 'Cash' };
export const STATUS_LABEL: Record<SupplierPaymentStatus, string> = { draft: 'Draft', submitted: 'Waiting for approval', sent_back: 'Sent back', rejected: 'Rejected', approved: 'Approved, to pay', paid: 'Paid', cancelled: 'Cancelled' };
export const statusTone = (s: SupplierPaymentStatus): 'success' | 'info' | 'warning' | 'danger' | 'neutral' =>
  (s === 'paid' ? 'success' : s === 'approved' || s === 'submitted' ? 'info' : s === 'sent_back' ? 'warning' : s === 'rejected' ? 'danger' : 'neutral');
export const AGEING_LABEL: Record<keyof Ageing, string> = { notDue: 'Not due', d0_30: '0-30 days', d31_60: '31-60 days', d61_90: '61-90 days', d90plus: 'Over 90 days' };

// Same rules as the API: accounts (supplier invoice verifiers) write; buyers read.
export const canPaySuppliers = (u: User | null | undefined) => can(u, PERMS.SUPPLIER_INVOICE_VERIFY);
export const canSeePayables = (u: User | null | undefined) => canPaySuppliers(u) || can(u, PERMS.PURCHASE_MANAGE);

const qs = (q: Record<string, string | undefined>) => {
  const p = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return p ? `?${p}` : '';
};
const P = '/supplier-payments';

export const supplierPaymentApi = {
  vendorNames: () => api<{ id: string; name: string }[]>('/vendors/names'),
  payables: (q: { asOf?: string; basis?: 'invoice' | 'due'; vendorId?: string } = {}) => api<Payables>(`${P}/payables${qs(q)}`),
  openInvoices: (vendorId: string) => api<OpenInvoice[]>(`${P}/vendors/${vendorId}/open-invoices`),
  ledger: (vendorId: string, q: { from?: string; to?: string } = {}) => api<SupplierLedger>(`${P}/vendors/${vendorId}/ledger${qs(q)}`),
  ledgerExcel: (vendorId: string, q: { from?: string; to?: string } = {}) => apiBlob(`${P}/vendors/${vendorId}/ledger.xlsx${qs(q)}`),
  list: (q: { vendorId?: string; status?: SupplierPaymentStatus; advance?: 'true' } = {}) => api<SupplierPayment[]>(`${P}${qs(q)}`),
  get: (id: string) => api<SupplierPayment>(`${P}/${id}`),
  create: (body: PaymentInput) => api<SupplierPayment>(P, { method: 'POST', body }),
  update: (id: string, body: PaymentInput) => api<SupplierPayment>(`${P}/${id}`, { method: 'PUT', body }),
  submit: (id: string) => api<SupplierPayment>(`${P}/${id}/submit`, { method: 'POST' }),
  pay: (id: string, body: { paidDate: string; reference?: string; mode?: SupplierPaymentMode }) => api<SupplierPayment>(`${P}/${id}/pay`, { method: 'POST', body }),
  cancel: (id: string, reason: string) => api<SupplierPayment>(`${P}/${id}/cancel`, { method: 'POST', body: { reason } }),
  adjust: (id: string, allocations: { supplierInvoiceId: string; amount: number }[]) => api<SupplierPayment>(`${P}/${id}/adjust`, { method: 'POST', body: { allocations } }),
  // Payment proof (bank advice, cheque copy): up to 5 photos or PDFs per payment.
  addAttachment: (id: string, picked: PickedFile) => api<SupplierPayment>(`${P}/${id}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  downloadAttachment: (id: string, a: { id: string }) => apiBlob(`${P}/${id}/attachments/${a.id}`),
};
