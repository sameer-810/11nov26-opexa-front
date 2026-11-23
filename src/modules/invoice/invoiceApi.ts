import { Linking, Platform } from 'react-native';
import { env } from '../../config/env';
import { api } from '../../shared/api/apiClient';

export type Basis = 'lots' | 'installed' | 'manual' | 'measurement' | 'milestone';
export type PreviewLine = { workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; rate: number; hsnSac?: string; gstRate?: number; billedBefore: number; suggestedQty: number; overBoq: boolean };
export type Preview = {
  project: { id: string; code: string; name: string; clientName: string; clientGstin: string; billingAddress: string; clientState: string; poNumber: string };
  lots: { id: string; lotNo: number; challanNo: string; dispatchDate: string; received: boolean; billedOn: string | null }[];
  lines: PreviewLine[];
};
export type InvoiceLine = { id: string; workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; billedBefore: number; qty: number; rate: number; amount: number; hsnSac?: string; gstRate?: number; overBoq: boolean; overBoqChoice: 'boq' | 'actual' | null; additional?: boolean };
export type GstRow = { rate: number; taxable: number; cgst: number; sgst: number; igst: number };
export type Invoice = {
  id: string; number: string | null; draftNo: number; label: string; status: 'draft' | 'issued' | 'cancelled'; basis: Basis;
  project: { id: string; code?: string; name?: string }; lotIds: string[]; invoiceDate: string;
  client: { name: string; gstin: string; address: string; state: string; poNumber: string };
  gstRate: number; interState: boolean; lines: InvoiceLine[]; additionalTaxable?: number; taxable: number; cgst: number; sgst: number; igst: number; roundOff: number; total: number; totalInWords: string;
  notes: string; edits: { at: string; byName: string; reason: string; summary: string }[];
  kind?: 'standard' | 'milestone' | 'measurement'; milestoneLine?: { description: string; percent: number; planAmount: number; amount: number } | null;
  retentionPct?: number; retention?: number; received?: number; tds?: number; outstanding?: number; revisions?: { revision: number; at: string; reason: string; snapshot?: { total?: number } }[];
  // Q27 / 4A-4C: 'line' = GST per line (older invoices: one rate); advance / progress slab invoices; RA number; early billing and amount overrides.
  gstMode?: 'invoice' | 'line'; gstSummary?: GstRow[]; invoiceType?: 'advance' | 'progress' | null; raNo?: number | null; raLabel?: string | null;
  earlyBilling?: { status: 'pending' | 'approved' | 'rejected' | 'sent_back'; reason: string; at: string; approvalRequestId: string | null } | null;
  overrides?: { amount: number; computedAmount: number; reason: string; byName: string; at: string }[];
  attachments: { id: string; name: string; contentType: string; size: number; url: string | null }[];
  issuedAt: string | null; cancelReason: string | null; createdAt: string;
};
export type LineIn = { workOrderItemId: string; qty: number; rate?: number; hsnSac?: string; gstRate?: number; overBoqChoice?: 'boq' | 'actual' };
export type InvoiceIn = { projectId: string; basis: Basis; lotIds?: string[]; invoiceDate: string; gstRate: number; interState: boolean; client?: { gstin?: string; address?: string; state?: string }; notes?: string; lines: LineIn[] };
export type Billing = { legalName: string; address: string; gstin: string; state: string; email: string; bankName: string; bankAccount: string; ifsc: string; invoicePrefix: string; terms: string };

export const invoiceApi = {
  list: (projectId?: string) => api<Invoice[]>(`/invoices${projectId ? `?projectId=${projectId}` : ''}`),
  preview: (projectId: string, basis: Basis, lotIds: string[] = []) => api<Preview>(`/invoices/preview/${projectId}?basis=${basis}&lotIds=${lotIds.join(',')}`),
  create: (body: InvoiceIn) => api<Invoice>('/invoices', { method: 'POST', body }),
  get: (id: string) => api<Invoice>(`/invoices/${id}`),
  update: (id: string, body: Partial<InvoiceIn> & { editReason?: string; milestoneAmount?: number }) => api<Invoice>(`/invoices/${id}`, { method: 'PATCH', body }),
  issue: (id: string) => api<Invoice>(`/invoices/${id}/issue`, { method: 'POST' }),
  cancel: (id: string, reason: string) => api<Invoice>(`/invoices/${id}/cancel`, { method: 'POST', body: { reason } }),
  attach: (id: string, file: Blob | { uri: string; name: string; type: string }, name: string) => {
    const f = new FormData();
    if (typeof Blob !== 'undefined' && file instanceof Blob) f.append('file', file, name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else f.append('file', file as any);
    return api<Invoice>(`/invoices/${id}/attachments`, { method: 'POST', body: f });
  },
  removeAttachment: (id: string, attId: string) => api<Invoice>(`/invoices/${id}/attachments/${attId}`, { method: 'DELETE' }),
  printLink: (id: string) => api<{ url: string; raUrl?: string }>(`/invoices/${id}/print-link`),
  lotPrintLink: (projectId: string, lotId: string) => api<{ url: string }>(`/projects/${projectId}/lots/${lotId}/print-link`),
  billing: () => api<Billing>('/invoices/billing-details'),
  setBilling: (body: Billing) => api<Billing>('/invoices/billing-details', { method: 'PUT', body }),
};

// Opens a signed print page: new browser tab on the web, the phone's browser in the app.
export async function openPrint(url: string) {
  const full = env.apiUrl + url;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(full, '_blank', 'noopener');
  else await Linking.openURL(full);
}

export const STATUS_LABEL = { draft: 'Draft', issued: 'Issued', cancelled: 'Cancelled' } as const;
export const STATUS_TONE = { draft: 'warning', issued: 'success', cancelled: 'neutral' } as const;

// 3E: extra-work (non-tendered) lines get their own section; invoices without them read as before.
export function lineGroups(lines: InvoiceLine[]) {
  const extra = lines.filter((l) => l.additional);
  if (!extra.length) return [{ key: 'all', title: '', lines }];
  const boq = lines.filter((l) => !l.additional);
  return [...(boq.length ? [{ key: 'boq', title: 'BOQ (tendered) items', lines: boq }] : []), { key: 'additional', title: 'Additional / non-tendered items', lines: extra }];
}
