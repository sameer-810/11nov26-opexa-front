export type PoLine = { id: string; requisitionId: string; requisitionLineId: string; serialNo: string; description: string; unit: string; qty: number; rate: number; amount: number; dispatched: number; pending: number; delivery?: { sent: number; accepted: number } };
export type Lot = { id: string; lotNo: number; challanNo: string; dispatchDate: string; vehicleNo: string | null; lines: { poLineId: string; serialNo: string; description: string; unit: string; qty: number }[] };

export type PurchaseOrder = {
  id: string;
  number: string;
  status: 'issued' | 'cancelled';
  deliveryStatus: 'not-dispatched' | 'partly-dispatched' | 'dispatched' | 'cancelled';
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  vendor: { id: string; name: string; phone: string | null } | null;
  expectedDate: string | null;
  notes: string;
  cancelReason: string | null;
  createdAt: string;
  total: number;
  // Store that holds direct-to-site deliveries on its books (Q14); null = Central Store.
  custodyWarehouseId?: string | null;
  custodyWarehouseName?: string;
  lines: PoLine[];
  lots: Lot[];
};

export type NewPo = { requisitionId: string; vendorId: string; lines: { requisitionLineId: string; qty: number; rate?: number }[]; notes?: string; custodyWarehouseId?: string };
export type NewDispatch = { challanNo: string; dispatchDate: string; vehicleNo?: string; lines: { poLineId: string; qty: number }[] };

export type ProjectLot = { id: string; lotNo: number; challanNo: string; dispatchDate: string; poNumber: string | null; vendorName: string | null; lines: { serialNo: string; description: string; unit: string; qty: number }[] };

export const DELIVERY_LABEL: Record<PurchaseOrder['deliveryStatus'], string> = {
  'not-dispatched': 'Not dispatched',
  'partly-dispatched': 'Partly dispatched',
  dispatched: 'Fully dispatched',
  cancelled: 'Cancelled',
};
