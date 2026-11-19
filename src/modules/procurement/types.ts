export type SupplierLink = { vendorId: string; vendorName: string | null; email: string | null; phone: string | null; portalPath: string; expiresAt: string };

export type RfqLine = { requisitionLineId: string; serialNo: string; description: string; specification: string; unit: string; qty: number };
export type RfqSupplier = { vendorId: string; vendorName: string | null; email: string | null; status: 'pending' | 'quoted' | 'declined'; sentAt: string | null; emailStatus: string; linkActive: boolean; declineReason: string | null };
export type QuoteLine = { requisitionLineId: string; qty: number; rate: number; discount: number; taxPercent: number; specification: string };
export type Quotation = {
  id: string; vendorId: string; vendorName: string | null; version: number; isCurrent: boolean; number: string; quoteDate: string; validUntil: string | null;
  deliveryDays: number | null; paymentTerms: string; freight: number; other: number; remarks: string; total: number; source: 'purchaser' | 'portal'; submittedAt?: string; hasAttachment?: boolean; lines: QuoteLine[];
};
export type HistoryEntry = { action: string; detail: string; by: string | null; at: string };
export type RfqStatus = 'draft' | 'sent' | 'closed' | 'cancelled';
export type Rfq = {
  id: string; number: string; status: RfqStatus; requisitionId: string; projectId: string; deadline: string; expectedDate: string | null; paymentTerms: string;
  deliveryLocation: string; terms: string; remarks: string; evaluationRemarks: string; deadlinePassed: boolean; suppliers: RfqSupplier[]; lines: RfqLine[];
  requisitionNumber?: string | null; projectName?: string | null; projectCode?: string | null; quotations?: Quotation[]; history?: HistoryEntry[];
  quotedCount?: number; pendingCount?: number; links?: SupplierLink[];
};
export type NewRfq = { requisitionId: string; vendorIds: string[]; deadline: string; lines?: { requisitionLineId: string; qty: number; specification?: string }[]; expectedDate?: string; paymentTerms?: string; deliveryLocation?: string; terms?: string; remarks?: string; publish?: boolean };
export type NewQuote = { vendorId: string; number: string; validUntil?: string; deliveryDays?: number; paymentTerms?: string; freight?: number; other?: number; remarks?: string; lines: { requisitionLineId: string; qty: number; rate: number; discount?: number; taxPercent?: number }[] };

export type Offer = { vendorId: string; vendorName: string | null; quoteId: string; qty: number; rate: number; discount: number; taxPercent: number; gst: number; taxable: number; charges: number; landed: number; landedPerUnit: number; fullQty: boolean; expired: boolean; lowest: boolean };
export type Comparison = {
  rfq: { id: string; number: string; status: RfqStatus; deadline: string; evaluationRemarks: string };
  suppliers: { vendorId: string; vendorName: string | null; status: string; declineReason: string | null; quote: null | { id: string; number: string; version: number; validUntil: string | null; expired: boolean; deliveryDays: number | null; paymentTerms: string; remarks: string; taxable: number; gst: number; freight: number; other: number; total: number; coversAll: boolean } }[];
  lines: { requisitionLineId: string; serialNo: string; description: string; unit: string; qty: number; offers: Offer[]; lowestVendorId: string | null }[];
  lowestTotalVendorId: string | null;
  missingQuotations: string[];
  selections: { id: string; number: string; status: string; amount: number; justification: string; createdAt: string }[];
};

export type Allocation = { requisitionLineId: string; serialNo: string | null; description: string | null; unit: string | null; vendorId: string; vendorName: string | null; quoteId: string; quoteNumber: string | null; qty: number; rate: number; discount: number; taxPercent: number; amount: number; lowest: boolean };
export type Selection = { id: string; number: string; status: 'pending_approval' | 'approved' | 'rejected' | 'sent_back' | 'ordered' | 'cancelled'; rfqId: string; rfqNumber: string | null; requisitionId: string; requisitionNumber: string | null; justification: string; amount: number; createdAt: string; purchaseOrderIds: string[]; allocations: Allocation[]; history?: HistoryEntry[] };

export type Delivery = { ordered: number; sent: number; inTransit: number; accepted: number; damaged: number; short: number; pending: number };
export type Revision = { id: string; revisionNo: number; reason: string; status: string; changes: { field: string; from: unknown; to: unknown }[]; requestedAt: string; appliedAt: string | null };
export type FollowUp = { id: string; vendorId: string; purchaseOrderId: string | null; method: string; status: string; remarks: string; supplierResponse: string; followUpDate: string; nextFollowUpDate: string | null; promisedDate: string | null; responsible: { id: string; name: string | null } };
export type ProcurementPo = {
  id: string; number: string; status: string; revision: number; pendingRevisionId: string | null; receiptStatus: string; overdue: boolean; rfqNumber: string | null; requisitionNumbers: string[];
  vendor: { id: string; name: string } | null; expectedDate: string | null; paymentTerms: string; terms: string; deliveryAddress: string; freight: number; otherCharges: number;
  taxable: number; gst: number; cgst: number; sgst: number; igst: number; total: number;
  lines: { id: string; serialNo: string; description: string; unit: string; qty: number; rate: number; discount: number; taxPercent: number; cancelledQty: number; delivery: Delivery }[];
  lots: { id: string; lotNo: number; challanNo: string; receivedAt: string | null }[];
  revisions: Revision[]; followUps: FollowUp[]; history: HistoryEntry[];
};
export type RevisionInput = { reason: string; expectedDate?: string; paymentTerms?: string; terms?: string; freight?: number; otherCharges?: number; lines?: { poLineId: string; qty?: number; rate?: number; taxPercent?: number; discount?: number }[] };

export type BoardRow = { purchaseOrderId: string; number: string; vendor: { id: string; name: string } | null; projectName: string | null; expectedDate: string | null; overdue: boolean; daysOverdue: number; pendingQty: number; pendingValue: number; lastFollowUp: FollowUp | null; nextFollowUpDate: string | null; followUpDue: boolean };
export type NewFollowUp = { purchaseOrderId?: string; vendorId?: string; method: 'call' | 'email' | 'whatsapp' | 'visit' | 'other'; status?: string; remarks: string; supplierResponse?: string; nextFollowUpDate?: string; promisedDate?: string };

export type PendingRow = { requisitionId: string; requisitionNumber: string; requisitionLineId: string; projectName: string | null; department: string | null; serialNo: string; description: string; unit: string; requested: number; approved: number; rfq: number; quoted: number; selected: number; ordered: number; received: number; accepted: number; rejected: number; cancelled: number; toOrder: number; pending: number; suppliers: string[]; expectedDate: string | null };
export type PendingGroup = { key: string; lines: number; approved: number; ordered: number; accepted: number; pending: number; toOrder: number };
export type PendingQuantities = { rows: PendingRow[]; byProject: PendingGroup[]; byDepartment: PendingGroup[]; byMaterial: PendingGroup[]; bySupplier: PendingGroup[]; byExpectedDate: PendingGroup[] };

export type Dashboard = { sections: Record<string, number>; kpis: Record<string, number>; generatedAt: string };

export type InvoiceStatus = 'draft' | 'submitted' | 'under_verification' | 'matched' | 'mismatch' | 'rejected' | 'approved' | 'cancelled';
export type SupplierInvoice = {
  id: string; number: string; financialYear: string; invoiceDate: string; status: InvoiceStatus; vendor: { id: string; name: string; gstin: string | null } | null; supplierGstin: string | null;
  purchaseOrderId: string; purchaseOrderNumber: string | null; lots: { id: string; lotNo: number; challanNo: string }[];
  lines: { poLineId: string; serialNo: string; description: string; unit: string; qty: number; rate: number; discount: number; taxPercent: number }[];
  taxable: number; cgst: number; sgst: number; igst: number; other: number; total: number; mismatches: { code: string; message: string }[]; remarks: string; verificationRemarks: string; history?: HistoryEntry[];
};
export type NewSupplierInvoice = { purchaseOrderId: string; lotIds: string[]; number: string; invoiceDate: string; supplierGstin?: string; lines: { poLineId: string; qty: number; rate: number; discount?: number; taxPercent?: number }[]; taxable: number; cgst?: number; sgst?: number; igst?: number; other?: number; total: number; remarks?: string };

export const RFQ_TONE = { draft: 'warning', sent: 'info', closed: 'success', cancelled: 'neutral' } as const;
export const INVOICE_TONE: Record<InvoiceStatus, 'neutral' | 'success' | 'danger' | 'info' | 'warning'> = { draft: 'neutral', submitted: 'info', under_verification: 'info', matched: 'success', mismatch: 'danger', rejected: 'danger', approved: 'success', cancelled: 'neutral' };
export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
