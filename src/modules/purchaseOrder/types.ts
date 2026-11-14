export type PoLine = { id: string; requisitionId: string; requisitionLineId: string; serialNo: string; description: string; unit: string; qty: number; rate: number; amount: number; dispatched: number; pending: number };
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
  lines: PoLine[];
  lots: Lot[];
};

export type NewPo = { requisitionId: string; vendorId: string; lines: { requisitionLineId: string; qty: number; rate?: number }[]; notes?: string };
export type NewDispatch = { challanNo: string; dispatchDate: string; vehicleNo?: string; lines: { poLineId: string; qty: number }[] };

export type ProjectLot = { id: string; lotNo: number; challanNo: string; dispatchDate: string; poNumber: string | null; vendorName: string | null; lines: { serialNo: string; description: string; unit: string; qty: number }[] };

export const DELIVERY_LABEL: Record<PurchaseOrder['deliveryStatus'], string> = {
  'not-dispatched': 'Not dispatched',
  'partly-dispatched': 'Partly dispatched',
  dispatched: 'Fully dispatched',
  cancelled: 'Cancelled',
};
