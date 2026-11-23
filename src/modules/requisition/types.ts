export type BalanceRow = { workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; requested: number; balance: number };

export type LineStatus = 'approved' | 'reduced' | 'rejected';

export type RequisitionLine = {
  id: string;
  workOrderItemId: string | null; // null: non-BOQ material from the master (not billed)
  materialId?: string | null;
  billable?: boolean;
  newMaterial?: boolean; // material added from a request, not yet verified by the purchaser
  status?: LineStatus | null;
  rejectReason?: string | null;
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
  remarks?: string;
  deliveryAddress?: string;
  attachments?: Attachment[];
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

export type Attachment = { id: string; name: string; contentType: string; size: number; uploadedAt?: string };

// A line is a BOQ item, package material against a BOQ item (billable: false), or a non-BOQ material (materialId only).
export type NewRequisitionLine = { workOrderItemId?: string; materialId?: string; billable?: boolean; qty: number; reason?: string; specification?: string };
export type NewRequisition = {
  lines: NewRequisitionLine[];
  deliveryAddress?: string;
  neededBy?: string;
  remarks?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  department?: string;
};

export type TimelineEvent = {
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'sent_back' | 'resubmitted' | 'cancelled' | 'ordered' | 'dispatched' | 'received';
  at: string;
  by: { id: string; name: string; role: string } | null;
  comment: string;
  level?: number;
  levelRole?: string | null;
};

// One entry per line that would go past the BOQ (from the API's OVER_BOQ answer).
export type OverBoqLine = { field: string; message: string; serialNo: string; boqQty: number; previouslyRequested: number; qtyRequested: number; overBy: number };

export const REQ_STATUS_LABEL = { pending_approval: 'Waiting for approval', open: 'Open', rejected: 'Rejected', sent_back: 'Sent back', cancelled: 'Cancelled' } as const;
export const LINE_STATUS_LABEL = { approved: 'Approved', reduced: 'Reduced', rejected: 'Rejected' } as const;
export const PURCHASE_LABEL = { 'to-order': 'To order', 'partly-ordered': 'Partly ordered', ordered: 'Ordered', received: 'Received at site', cancelled: 'Cancelled' } as const;
