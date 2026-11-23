export type VendorBank = { accountName: string | null; bankName: string | null; ifsc: string | null; accountNumber: string | null; masked: boolean };
export type VendorContact = { name: string; role: string | null; phone: string | null; email: string | null; isPrimary: boolean };
export type Vendor = {
  id: string; code: string | null; name: string; contactPerson: string | null; phone: string | null; email: string | null; gstin: string | null; pan: string | null;
  address: string | null; city: string | null; state: string | null; paymentTerms: string | null; category: string | null; materials: string[]; bank: VendorBank | null; isActive: boolean;
  contacts: VendorContact[]; paymentTermsDays: number | null;
};
export type VendorDocument = { id: string; label: string | null; name: string; contentType: string; size: number; validUntil: string | null; uploadedAt: string };
export type VendorDetail = Vendor & { documents: VendorDocument[]; activity: { purchaseOrders: number; openPurchaseOrders: number; rfqs: number; invoices: number; followUps: number } };
export type VendorHistory = {
  vendor: { id: string; name: string; code: string | null };
  rfqs: { id: string; number: string; date: string; status: string; supplierStatus: string | null; quoteTotal: number | null }[];
  purchaseOrders: { id: string; number: string; date: string; status: string; expectedDate: string | null; value: number; projectId: string }[];
  deliveries: { id: string; lotNo: number; challanNo: string; dispatchDate: string; receivedAt: string | null; projectId: string; purchaseOrderId: string; purchaseOrderNumber: string | null; onTime: boolean | null }[];
  invoices: { id: string; number: string; invoiceDate: string; status: string; total: number; purchaseOrderNumber: string | null }[];
  payments: { id: string; number: string; date: string; status: string; amount: number; tds: number }[];
  totals: { purchaseOrderValue: number; invoiced: number; paid: number };
};
export type PriceTrend = { material: string; unit: string; firstRate: number; lastRate: number; changePct: number | null; points: { date: string; rate: number; purchaseOrderNumber: string }[] };
export type VendorPerformance = {
  vendorId: string; vendorName?: string | null; vendorCode?: string | null; deliveries: number; onTimePct: number | null; onTimeChecked: number; avgLeadDays: number | null;
  orderedQty: number; shortQty: number; damagedQty: number; shortPct: number | null; damagedPct: number | null; invoices: number; invoiceMismatches: number; score: number | null;
};
export type VendorPerformanceDetail = VendorPerformance & { from: string; to: string; priceTrend: PriceTrend[] };
export type VendorInput = {
  name: string; contactPerson?: string; phone?: string; email?: string; gstin?: string; pan?: string; address?: string; city?: string; state?: string;
  paymentTerms?: string; paymentTermsDays?: number | null; contacts?: { name: string; role?: string; phone?: string; email?: string; isPrimary?: boolean }[]; category?: string; materials?: string[]; bank?: { accountName?: string; bankName?: string; ifsc?: string; accountNumber?: string };
};
