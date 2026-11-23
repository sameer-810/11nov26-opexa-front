export type Material = { id: string; code: string; name: string; unit: string; category: string | null; minStock: number; isActive: boolean; description?: string; specifications?: string; verification?: 'pending' | 'verified'; mergedInto?: string | null };
export type MaterialInput = { name: string; unit: string; category?: string; minStock?: number; description?: string; specifications?: string };
export type Warehouse = { id: string; code: string; name: string; address: string; isCentral: boolean; managerIds: string[]; isActive: boolean };
export type Location = { kind: 'warehouse' | 'site' | 'transit' | 'custody' | 'damaged'; id: string; name: string };
// damaged: quantity in the warehouse's damaged holding area (Q16); never part of on hand or available.
export type StockRow = { materialId: string; code: string; name: string; unit: string; location: Location; onHand: number; reserved: number; available: number; damaged?: number; value: number; avgRate: number; minStock: number; reorderQty?: number; low: boolean };
export type DamagedInput = { warehouseId: string; materialId: string; qty: number; reason: string; purchaseOrderId?: string };
export type LedgerRow = { id: string; txnNo: string; date: string; type: string; material: string | null; unit: string; qty: number; rate: number; value: number; location: Location; refType: string; refNo: string; note: string };
export type TransferLine = { id: string; materialId: string; name: string; unit: string; workOrderItemId: string | null; billable: boolean; qty: number; qtyDispatched: number; qtyReceived: number; qtyShort: number; inTransit: number };
export type Transfer = { id: string; number: string; status: string; fromWarehouseId: string; to: { kind: 'warehouse' | 'site'; id: string }; reason: string; challanNo: string; gatePassNo: string; vehicleNo: string; dispatchedAt: string | null; createdAt: string; lines: TransferLine[] };
export type Issue = { id: string; number: string; status: 'issued' | 'closed'; from: { kind: string; id: string }; projectId: string | null; issuedTo: { kind: string; name: string }; purpose: string; createdAt: string; lines: { id: string; name: string; unit: string; qty: number; qtyReturned: number; qtyConsumed: number; withHolder: number }[] };
export type Adjustment = { id: string; number: string; status: 'pending' | 'approved' | 'rejected'; location: { kind: string; id: string }; reason: string; createdAt: string; lines: { id: string; name: string; unit: string; bookQty: number; physicalQty: number; qty: number }[] };
export type ToolCondition = 'good' | 'fair' | 'needs_repair' | 'damaged' | 'missing' | 'scrapped';
export type Party = { kind: 'employee' | 'subcontractor' | 'other'; name: string; refId?: string };
export type Tool = {
  id: string; code: string; name: string; serialNo: string; category: string; condition: ToolCondition; status: 'available' | 'issued' | 'in_repair' | 'missing' | 'scrapped';
  nextServiceDue?: string | null; serviceDue?: boolean;
  holder: null | { kind: string; name: string; projectId: string | null; issuedAt: string; expectedReturn: string | null; conditionAtIssue?: string | null; overdue: boolean };
};
export type ToolMaintenance = { id: string; type: 'repair' | 'service' | 'calibration'; status: 'open' | 'done'; date: string; completedAt: string | null; vendor: string; cost: number; notes: string; nextDueDate: string | null; projectId: string | null; project: string | null; documentIds: string[] };
export type ToolHistory = Tool & {
  history: { action: string; holderName: string; condition: string; note: string; project: string | null; responsible: { kind: string; name: string } | null; recoveryAmount: number | null; by: string | null; date: string }[];
  maintenance: ToolMaintenance[];
};
// Physical verification (2F.4): system qty from the ledger at count start; variance = counted + damaged - system.
export type CountLine = { id: string; materialId: string; code: string; name: string; unit: string; category: string; systemQty: number; rate: number; countedQty: number | null; damagedQty: number; reason: string; variance: number | null; varianceValue: number | null; damagedValue: number };
export type StockCount = {
  id: string; number: string; status: 'open' | 'submitted' | 'approved' | 'rejected' | 'completed' | 'cancelled'; location: { kind: 'warehouse' | 'site'; id: string; name: string };
  countDate: string; countedBy: { id: string; name: string }; scope: { type: 'all' | 'category' | 'selected'; category: string; materialIds: string[] }; note: string; adjustmentId: string | null; createdAt: string;
  lines: CountLine[]; totals: { lines: number; counted: number; withVariance: number; shortValue: number; excessValue: number; netValue: number; damagedValue: number };
};
export type StockLevel = { id: string; materialId: string; location: { kind: 'warehouse' | 'site'; id: string }; minQty: number | null; reorderQty: number };
