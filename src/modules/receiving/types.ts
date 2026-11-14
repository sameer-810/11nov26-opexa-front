export type LotStatus = 'in-transit' | 'received' | 'received-short';

export type LotLine = {
  id: string; serialNo: string; description: string; unit: string; qty: number;
  qtyReceived: number | null; qtyDamaged: number; qtyShort: number | null; remark: string;
};

export type Lot = {
  id: string; lotNo: number; challanNo: string; dispatchDate: string; vehicleNo: string | null;
  poNumber: string | null; vendorName: string | null; status: LotStatus; daysInTransit: number | null;
  receivedAt: string | null; receivedBy: { id: string; name: string } | null; receiptNotes: string; lines: LotLine[];
};

export type ReceiveInput = { receivedAt?: string; notes?: string; lines: { lineId: string; qtyReceived: number; qtyDamaged?: number; remark?: string }[] };

export type LocalPurchase = {
  id: string; number: string; workOrderItemId: string; serialNo: string; description: string; unit: string;
  qty: number; rate: number; amount: number; vendorName: string; billNo: string | null; purchaseDate: string;
  reason: string; overBy: number; createdBy: { id: string; name: string } | null; createdAt: string;
};

export type NewLocalPurchase = { workOrderItemId: string; qty: number; rate: number; vendorName: string; billNo?: string; purchaseDate: string; reason: string };

export type MaterialRow = {
  workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number;
  requested: number; ordered: number; inTransit: number; received: number; damaged: number; localPurchased: number;
  transferredIn: number; returned: number; netSupplied: number; installed: number; rate?: number;
  atSite: number; pending: number; notOrdered: number; awaitingDispatch: number; boqBalance: number;
};

export type MaterialStatus = {
  projectId: string; projectName: string;
  summary: { itemsPending: number; lotsInTransit: number; lotsOverdue: number; itemsOverBoq: number };
  items: MaterialRow[];
};

export const LOT_LABEL: Record<LotStatus, string> = { 'in-transit': 'On the way', received: 'Received', 'received-short': 'Received short' };
export const LOT_TONE = { 'in-transit': 'warning', received: 'success', 'received-short': 'danger' } as const;
