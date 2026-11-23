import { api, apiBlob } from '../../shared/api/apiClient';
import { attachmentForm, type PickedFile } from '../requisition/api/requisitionApi';
import type { Attachment } from '../requisition/types';
import type { User } from '../auth/types';
import { can, PERMS } from '../../shared/permissions';

export type ExpenseStatus = 'draft' | 'submitted' | 'sent_back' | 'rejected' | 'approved' | 'paid' | 'void';
export type PaymentMode = 'cash' | 'bank' | 'upi';
export type Expense = {
  id: string; number: string | null; status: ExpenseStatus; direct: boolean; date: string; amount: number; category: string; categoryId: string | null;
  note: string; billNo: string; projectId: string | null; projectName: string | null; projectCode: string | null;
  employee: { id: string | null; name: string | null } | null; attachments: Attachment[]; reviewComment: string; approvalRequestId: string | null;
  submittedAt: string | null; payment: { mode: PaymentMode; reference: string; paidDate: string } | null;
  voided: { reason: string; at: string; tallyReversedAt: string | null } | null; createdAt: string;
};
export type ExpenseCategory = { id: string; name: string; receiptRequired: boolean; tallyLedger: string; isActive: boolean };
export type ExpenseInput = { categoryId: string; amount: number; date: string; projectId: string | null; note: string; billNo?: string };
export type ReportFilters = { from?: string; to?: string; employeeId?: string; projectId?: string; category?: string; status?: ExpenseStatus };
export type ExpenseReport = {
  rows: Expense[]; total: { count: number; amount: number };
  byCategory: { category: string; count: number; amount: number }[];
  byProject: { projectId: string | null; project: string; count: number; amount: number }[];
};

export const STATUS_LABEL: Record<ExpenseStatus, string> = { draft: 'Draft', submitted: 'Waiting for approval', sent_back: 'Sent back', rejected: 'Rejected', approved: 'Approved, to pay', paid: 'Paid', void: 'Void' };
export const statusTone = (s: ExpenseStatus): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => (s === 'paid' ? 'success' : s === 'approved' || s === 'submitted' ? 'info' : s === 'sent_back' ? 'warning' : s === 'rejected' ? 'danger' : 'neutral');

// Accounts: whoever exports to Tally pays expense vouchers (same rule as the API).
export const canPayExpenses = (u: User | null | undefined) => can(u, PERMS.INVOICE_EDIT) || can(u, PERMS.SUPPLIER_INVOICE_VERIFY);
export const canSeeExpenseReport = (u: User | null | undefined) => canPayExpenses(u) || can(u, PERMS.REPORTS_VIEW);

const qs = (f: ReportFilters) => {
  const q = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return q ? `?${q}` : '';
};

export const expenseApi = {
  categories: (all = false) => api<ExpenseCategory[]>(`/expenses/categories${all ? '?all=true' : ''}`),
  addCategory: (body: { name: string; receiptRequired?: boolean; tallyLedger?: string }) => api<ExpenseCategory>('/expenses/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Partial<Omit<ExpenseCategory, 'id'>>) => api<ExpenseCategory>(`/expenses/categories/${id}`, { method: 'PATCH', body }),
  mine: () => api<Expense[]>('/expenses/mine'),
  get: (id: string) => api<Expense>(`/expenses/${id}`),
  create: (body: ExpenseInput) => api<Expense>('/expenses', { method: 'POST', body }),
  update: (id: string, body: ExpenseInput) => api<Expense>(`/expenses/${id}`, { method: 'PUT', body }),
  discard: (id: string) => api<{ discarded: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),
  submit: (id: string) => api<Expense>(`/expenses/${id}/submit`, { method: 'POST' }),
  pay: (id: string, body: { mode: PaymentMode; reference?: string; paidDate: string }) => api<Expense>(`/expenses/${id}/pay`, { method: 'POST', body }),
  void: (id: string, reason: string) => api<Expense>(`/expenses/${id}/void`, { method: 'POST', body: { reason } }),
  addAttachment: (id: string, picked: PickedFile) => api<Expense>(`/expenses/${id}/attachments`, { method: 'POST', body: attachmentForm(picked) }),
  removeAttachment: (id: string, docId: string) => api<Expense>(`/expenses/${id}/attachments/${docId}`, { method: 'DELETE' }),
  downloadAttachment: (id: string, a: Pick<Attachment, 'id'>) => apiBlob(`/expenses/${id}/attachments/${a.id}`),
  report: (f: ReportFilters) => api<ExpenseReport>(`/expenses/report${qs(f)}`),
  reportExcel: (f: ReportFilters) => apiBlob(`/expenses/report.xlsx${qs(f)}`),
};
