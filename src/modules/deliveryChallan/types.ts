import type { Attachment } from '../requisition/types';

type Person = { id: string; name: string } | null;

export type ChallanLine = {
  id: string;
  requisitionLineId: string;
  serialNo: string;
  description: string;
  unit: string;
  specification: string;
  billable: boolean;
  qtyRequested: number;
  qtyApproved: number;
  deliveredBefore: number;
  qty: number;
  cumulative: number;
  pending: number;
  poQty: number;
  directQty: number;
};

export type DeliveryChallan = {
  id: string;
  number: string;
  date: string;
  status: 'active' | 'cancelled';
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  requisitionId: string;
  requisitionNumber: string | null;
  deliveryAddress: string;
  vendor: { id: string; name: string } | null;
  supplierName: string;
  vendorChallanNo: string;
  vehicleNo: string;
  remarks: string;
  receivedByName: string;
  preparedBy: Person;
  cancelledBy: Person;
  cancelledAt: string | null;
  cancelReason: string;
  createdAt: string;
  attachments: Attachment[];
  history: { action: 'created' | 'cancelled'; by: Person; at: string; comment: string }[];
  lines: ChallanLine[];
};

export type NewChallan = {
  requisitionId: string;
  vendorId?: string;
  supplierName?: string;
  vendorChallanNo?: string;
  vehicleNo?: string;
  remarks?: string;
  receivedByName?: string;
  lines: { lineId: string; qty: number }[];
};
