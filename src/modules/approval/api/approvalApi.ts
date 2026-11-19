import { api } from '../../../shared/api/apiClient';

export type PendingApproval = { id: string; transactionNumber: string; transactionType: string; amount: number; status: string; currentSequence: number; submittedAt: string };
export type ApprovalLine = { id: string; serialNo: string; description: string; unit: string; qtyRequested: number; qtyApproved: number; overBy: number };
export type ApprovalDetail = PendingApproval & {
  history: { action: string; sequence: number; comment: string; createdAt: string }[];
  details: null | {
    kind: 'requisition' | 'supplier_selection' | 'po_revision';
    priority?: string; department?: string | null; note?: string; lines?: ApprovalLine[];
    justification?: string; allocations?: { serialNo: string | null; description: string | null; unit: string | null; vendorName: string | null; qty: number; rate: number; amount: number; lowest: boolean }[];
    reason?: string; changes?: { field: string; from: unknown; to: unknown }[];
  };
};
export type ApprovalAction = 'approve' | 'reject' | 'send_back';

export const approvalApi = {
  pending: () => api<PendingApproval[]>('/approvals/pending'),
  get: (id: string) => api<ApprovalDetail>(`/approvals/${id}`),
  act: (id: string, action: ApprovalAction, comment?: string, approvedLines?: { lineId: string; qtyApproved: number }[]) =>
    api<ApprovalDetail>(`/approvals/${id}/action`, { method: 'POST', body: { action, comment, approvedLines } }),
};
