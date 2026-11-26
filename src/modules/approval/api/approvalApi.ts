import { api } from '../../../shared/api/apiClient';

// One entry of an approval's history: who did it, in which role, when, why, and for whom (delegation).
export type HistoryEntry = {
  action: 'submitted' | 'approved' | 'rejected' | 'sent_back' | 'resubmitted' | 'skipped' | 'escalated';
  sequence: number; comment: string; createdAt: string; levelRole: string | null;
  actedBy: string | null; actorName: string | null; actorRole: string | null; onBehalfOfId: string | null; onBehalfOfName: string | null;
};
export type PendingApproval = {
  id: string; transactionNumber: string; transactionType: string; amount: number; status: string; currentSequence: number; submittedAt: string;
  history?: HistoryEntry[];
};
export type ApprovalLine = {
  id: string; serialNo: string; description: string; unit: string; qtyRequested: number; qtyApproved: number; overBy: number;
  specification?: string; inBoq?: boolean; newMaterial?: boolean; status?: 'approved' | 'reduced' | 'rejected' | null; rejectReason?: string | null;
};
// Per-line decision on a material request: approve (possibly less) or reject with a reason.
export type LineDecision = { lineId: string; qtyApproved?: number; reject?: boolean; rejectReason?: string };
export type ApprovalDetail = PendingApproval & {
  history: HistoryEntry[];
  details: null | {
    kind: 'requisition' | 'supplier_selection' | 'po_revision' | 'expense' | 'over_receipt' | 'supplier_payment' | 'early_billing' | 'credit_note';
    expenseId?: string; number?: string | null; amount?: number; category?: string; date?: string; billNo?: string;
    projectName?: string | null; projectCode?: string | null; employee?: { id: string | null; name: string | null } | null;
    priority?: string; department?: string | null; note?: string; lines?: ApprovalLine[];
    requisitionId?: string; neededBy?: string | null; deliveryAddress?: string; attachments?: { id: string; name: string; contentType: string; size: number }[];
    justification?: string; allocations?: { serialNo: string | null; description: string | null; unit: string | null; vendorName: string | null; qty: number; rate: number; amount: number; lowest: boolean }[];
    reason?: string; changes?: { field: string; from: unknown; to: unknown }[];
    // Over-receipt (Q15): the extra quantity held on a lot, waiting for this decision.
    poNumber?: string | null; lotNo?: number | null; challanNo?: string | null;
    excess?: { serialNo: string; description: string; unit: string; qty: number; rate: number; ordered: number | null }[];
    // Supplier payment (Q5): who is paid, how, and which invoices it settles.
    supplierPaymentId?: string; vendor?: { id: string; name: string } | null; mode?: string; reference?: string; tds?: number; onAccount?: number;
    // Early billing of a payment-term slab (Q24).
    slab?: string; planAmount?: number; label?: string;
    // Credit / debit note (4D).
    noteKind?: 'credit' | 'debit'; side?: 'client' | 'supplier'; against?: string; party?: string; taxable?: number; gst?: number; total?: number; noteLines?: { description: string; qty: number; rate: number; amount: number; gstRate: number }[];
    invoices?: { supplierInvoiceId: string; invoiceNumber: string | null; invoiceDate: string | null; amount: number }[]; isAdvance?: boolean; remarks?: string;
  };
};
export type ApprovalAction = 'approve' | 'reject' | 'send_back';

export const TRANSACTION_TYPES = ['requisition', 'purchase_order', 'transfer', 'supplier_selection', 'po_revision', 'boq_baseline', 'boq_revision', 'additional_work', 'work_order', 'work_certificate', 'billing', 'expense', 'over_receipt', 'supplier_payment', 'retention_release', 'early_billing', 'credit_note'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type WorkflowLevel = { sequence: number; approverRole?: string | null; approverUserId?: string | null };
export type Workflow = {
  id: string; name: string; transactionType: TransactionType; projectId: string | null; departmentId: string | null; department: string | null;
  minAmount: number; maxAmount: number | null; levels: WorkflowLevel[]; isActive: boolean; isDefault: boolean; defaultKey: 'low' | 'high' | 'expense_project' | 'expense_office' | 'payment_low' | 'payment_high' | 'note_low' | 'note_high' | null; version: number;
};
export type WorkflowInput = {
  name: string; transactionType: TransactionType; projectId: string | null; departmentId: string | null; minAmount: number; maxAmount: number | null;
  levels: { sequence: number; approverRole?: string; approverUserId?: string }[]; isActive: boolean;
};
export type Person = { id: string; name: string; role: string; canApprove: boolean };
export type Delegation = {
  id: string; transactionType: string; startsAt: string; endsAt: string; active: boolean;
  delegator: { id: string; name: string | null }; delegate: { id: string; name: string | null };
};

export const approvalApi = {
  pending: () => api<PendingApproval[]>('/approvals/pending'),
  completed: () => api<PendingApproval[]>('/approvals/completed'),
  get: (id: string) => api<ApprovalDetail>(`/approvals/${id}`),
  act: (id: string, action: ApprovalAction, comment?: string, approvedLines?: LineDecision[]) =>
    api<ApprovalDetail>(`/approvals/${id}/action`, { method: 'POST', body: { action, comment, approvedLines } }),
  workflows: () => api<Workflow[]>('/approvals/workflows'),
  saveWorkflow: (body: WorkflowInput, id?: string) => api<Workflow>(id ? `/approvals/workflows/${id}` : '/approvals/workflows', { method: id ? 'PUT' : 'POST', body }),
  restoreDefault: () => api<Workflow[]>('/approvals/workflows/restore-default', { method: 'POST' }),
  people: () => api<Person[]>('/approvals/people'),
  delegations: () => api<{ given: Delegation[]; received: Delegation[] }>('/approvals/delegations'),
  delegate: (body: { delegateId: string; startsAt: string; endsAt: string }) => api<Delegation>('/approvals/delegations', { method: 'POST', body }),
  endDelegation: (id: string) => api<Delegation>(`/approvals/delegations/${id}/end`, { method: 'POST' }),
};
