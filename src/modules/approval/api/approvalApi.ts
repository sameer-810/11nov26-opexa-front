import { api } from '../../../shared/api/apiClient';

export type PendingApproval = { id: string; transactionNumber: string; transactionType: string; amount: number; status: string; currentSequence: number; submittedAt: string };
export type ApprovalLine = {
  id: string; serialNo: string; description: string; unit: string; qtyRequested: number; qtyApproved: number; overBy: number;
  specification?: string; inBoq?: boolean; newMaterial?: boolean; status?: 'approved' | 'reduced' | 'rejected' | null; rejectReason?: string | null;
};
// Per-line decision on a material request: approve (possibly less) or reject with a reason.
export type LineDecision = { lineId: string; qtyApproved?: number; reject?: boolean; rejectReason?: string };
export type ApprovalDetail = PendingApproval & {
  history: { action: string; sequence: number; comment: string; createdAt: string }[];
  details: null | {
    kind: 'requisition' | 'supplier_selection' | 'po_revision';
    priority?: string; department?: string | null; note?: string; lines?: ApprovalLine[];
    requisitionId?: string; neededBy?: string | null; deliveryAddress?: string; attachments?: { id: string; name: string; contentType: string; size: number }[];
    justification?: string; allocations?: { serialNo: string | null; description: string | null; unit: string | null; vendorName: string | null; qty: number; rate: number; amount: number; lowest: boolean }[];
    reason?: string; changes?: { field: string; from: unknown; to: unknown }[];
  };
};
export type ApprovalAction = 'approve' | 'reject' | 'send_back';

export const approvalApi = {
  pending: () => api<PendingApproval[]>('/approvals/pending'),
  get: (id: string) => api<ApprovalDetail>(`/approvals/${id}`),
  act: (id: string, action: ApprovalAction, comment?: string, approvedLines?: LineDecision[]) =>
    api<ApprovalDetail>(`/approvals/${id}/action`, { method: 'POST', body: { action, comment, approvedLines } }),
};
