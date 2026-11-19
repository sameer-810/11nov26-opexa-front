export type BalanceRow = { workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; requested: number; balance: number };

export type RequisitionLine = {
  id: string;
  workOrderItemId: string;
  serialNo: string;
  description: string;
  unit: string;
  boqQty: number;
  previouslyRequested: number;
  qtyRequested: number;
  qtyApproved?: number;
  specification?: string;
  overBy: number;
  overrideReason: string | null;
  ordered?: number;
  dispatched?: number;
  received?: number;
  pending?: number;
  toOrder?: number;
};

export type Requisition = {
  id: string;
  number: string;
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  raisedBy: { id: string; name: string | null };
  note: string;
  neededBy: string | null;
  status: 'pending_approval' | 'open' | 'rejected' | 'sent_back' | 'cancelled';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  department?: string | null;
  cancelReason: string | null;
  createdAt: string;
  overBoq: boolean;
  lines: RequisitionLine[];
  purchaseStatus?: 'to-order' | 'partly-ordered' | 'ordered' | 'received' | 'cancelled';
};

export type NewRequisition = { lines: { workOrderItemId: string; qty: number; reason?: string; specification?: string }[]; note?: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; department?: string };

// One entry per line that would go past the BOQ (from the API's OVER_BOQ answer).
export type OverBoqLine = { field: string; message: string; serialNo: string; boqQty: number; previouslyRequested: number; qtyRequested: number; overBy: number };

export const PURCHASE_LABEL = { 'to-order': 'To order', 'partly-ordered': 'Partly ordered', ordered: 'Ordered', received: 'Received at site', cancelled: 'Cancelled' } as const;
