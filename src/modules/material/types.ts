export type ReturnType = 'store' | 'vendor' | 'transfer';
export type ReturnStatus = 'pending' | 'accepted' | 'rejected';
type Person = { id: string; name: string } | null;

export type MaterialReturn = {
  id: string; number: string; type: ReturnType; projectId: string; projectName: string | null;
  vendor: { id: string; name: string } | null; toProject: { id: string; name: string; code: string } | null;
  reason: string; challanNo: string | null; status: ReturnStatus; decidedBy: Person; decidedAt: string | null; decisionNote: string;
  createdBy: Person; createdAt: string;
  lines: { id: string; workOrderItemId: string; serialNo: string; description: string; unit: string; qty: number; toWorkOrderItemId: string | null; toSerialNo: string | null }[];
};
export type NewReturn = { type: ReturnType; vendorId?: string; toProjectId?: string; reason: string; challanNo?: string; lines: { workOrderItemId: string; qty: number; toWorkOrderItemId?: string }[] };

export type Usage = {
  id: string; date: string; area: string; note: string; createdBy: Person; createdAt: string;
  lines: { workOrderItemId: string; serialNo: string; description: string; unit: string; qty: number }[];
};
export type NewUsage = { date: string; area?: string; note?: string; lines: { workOrderItemId: string; qty: number }[] };

export type StockCount = {
  id: string; number: string; countedAt: string; note: string; varianceValue: number; createdBy: Person; createdAt: string;
  lines: { workOrderItemId: string; serialNo: string; description: string; unit: string; expectedQty: number; countedQty: number; variance: number; varianceValue: number; reason: string }[];
};
export type NewStockCount = { note?: string; lines: { workOrderItemId: string; countedQty: number; reason?: string }[] };

export const RETURN_TYPE_LABEL: Record<ReturnType, string> = { store: 'Back to store', vendor: 'Back to vendor', transfer: 'To another project' };
export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = { pending: 'Waiting to confirm', accepted: 'Confirmed', rejected: 'Rejected' };
export const RETURN_TONE = { pending: 'warning', accepted: 'success', rejected: 'neutral' } as const;
