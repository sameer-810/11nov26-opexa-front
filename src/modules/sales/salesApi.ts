import { api } from '../../shared/api/apiClient';

export type LeadStatus = 'new' | 'contacted' | 'survey' | 'quoted' | 'negotiation' | 'won' | 'lost';
export type QuoteLine = { description: string; unit: string; qty: number; rate: number; amount?: number };
export type Quote = {
  id: string; leadId: string; number: string; version: number; label: string; status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'superseded';
  quoteDate: string; validTill: string | null; subject: string; lines: QuoteLine[]; gstRate: number; discount: number; taxable: number; gst: number; total: number; terms: string; sentAt: string | null;
};
export type Lead = {
  id: string; number: string; clientName: string; contactName: string; phone: string; email: string; siteAddress: string; source: string; requirement: string;
  estValue: number; status: LeadStatus; lostReason: string; nextFollowUp: string | null; followUpDue: boolean; owner: { id: string; name: string } | null; projectId: string | null;
  notes?: { at: string; byName: string; text: string }[]; quotes?: Quote[]; quotedValue?: number | null;
};
export type Summary = { stages: Record<LeadStatus, { count: number; value: number }>; followUpsDue: number; wonThisMonth: number; openCount: number; openValue: number; winRatePct: number | null };
export type NewLead = { clientName: string; contactName?: string; phone?: string; email?: string; siteAddress?: string; source: string; requirement?: string; estValue: number; nextFollowUp?: string; ownerId?: string };
export type QuoteInput = { quoteDate: string; validTill?: string; subject?: string; lines: QuoteLine[]; gstRate: number; discount: number; terms?: string };

export const salesApi = {
  summary: () => api<Summary>('/sales/summary'),
  people: () => api<{ id: string; name: string }[]>('/sales/people'),
  leads: (q: { status?: string; q?: string; due?: boolean } = {}) =>
    api<Lead[]>(`/sales/leads?${new URLSearchParams({ ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}), ...(q.due ? { due: '1' } : {}) })}`),
  lead: (id: string) => api<Lead>(`/sales/leads/${id}`),
  create: (body: NewLead) => api<Lead>('/sales/leads', { method: 'POST', body }),
  update: (id: string, body: Partial<NewLead> & { status?: LeadStatus; lostReason?: string; nextFollowUp?: string | null }) => api<Lead>(`/sales/leads/${id}`, { method: 'PATCH', body }),
  note: (id: string, text: string, nextFollowUp?: string) => api<Lead>(`/sales/leads/${id}/notes`, { method: 'POST', body: { text, ...(nextFollowUp ? { nextFollowUp } : {}) } }),
  createQuote: (leadId: string, body: QuoteInput) => api<Quote>(`/sales/leads/${leadId}/quotes`, { method: 'POST', body }),
  updateQuote: (id: string, body: QuoteInput) => api<Quote>(`/sales/quotes/${id}`, { method: 'PUT', body }),
  send: (id: string) => api<Quote>(`/sales/quotes/${id}/send`, { method: 'POST', body: {} }),
  revise: (id: string) => api<Quote>(`/sales/quotes/${id}/revise`, { method: 'POST', body: {} }),
  reject: (id: string) => api<Quote>(`/sales/quotes/${id}/reject`, { method: 'POST', body: {} }),
  printLink: (id: string) => api<{ url: string }>(`/sales/quotes/${id}/print-link`),
  convert: (leadId: string, quoteId: string, projectName?: string) => api<{ projectId: string; projectCode: string; lead: Lead }>(`/sales/leads/${leadId}/convert`, { method: 'POST', body: { quoteId, ...(projectName ? { projectName } : {}) } }),
};

export const STAGES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'survey', label: 'Site survey' },
  { value: 'quoted', label: 'Quoted' }, { value: 'negotiation', label: 'Negotiation' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<LeadStatus, string>;
export const STAGE_TONE = { new: 'info', contacted: 'info', survey: 'warning', quoted: 'warning', negotiation: 'warning', won: 'success', lost: 'neutral' } as const;
export const SOURCES = [
  { value: 'call', label: 'Phone call' }, { value: 'referral', label: 'Referral' }, { value: 'website', label: 'Website' }, { value: 'walk-in', label: 'Walk-in' },
  { value: 'tender', label: 'Tender' }, { value: 'existing-client', label: 'Existing client' }, { value: 'other', label: 'Other' },
];
export const QUOTE_LABEL = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected', superseded: 'Old version' } as const;

// Same maths as the server, for the live total while typing.
export function quoteTotals(lines: QuoteLine[], discount: number, gstRate: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const gross = r2(lines.reduce((s, l) => s + r2((l.qty || 0) * (l.rate || 0)), 0));
  const taxable = r2(gross - (discount || 0));
  const gst = r2((taxable * gstRate) / 100);
  return { gross, taxable, gst, total: Math.round(taxable + gst) };
}
