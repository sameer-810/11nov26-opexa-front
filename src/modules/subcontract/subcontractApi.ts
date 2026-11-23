import { api, apiBlob } from '../../shared/api/apiClient';

export type Subcontractor = { id: string; code: string; name: string; phone: string; gstin: string | null; categories: string[]; isActive: boolean };
export type Agreement = { id: string; number: string; subcontractorId: string; projectId: string; title: string; retentionPct: number; advanceRecoveryPct: number; status: string; revision: number; dlpEndsOn?: string | null };
export type WoLine = { id: string; serialNo: string; description: string; unit: string; qty: number; rate: number; approvedQty: number; enteredQty: number; pendingQty: number; progressPct: number };
export type WorkOrder = { id: string; number: string; agreementId: string; subcontractorId: string; projectId: string; status: string; value: number; approvedValue: number; progressPct: number; lines: WoLine[] };
export type Progress = { id: string; workOrderId: string; lineId: string; date: string; qty: number; verifiedQty: number | null; approvedQty: number | null; location: string; remarks: string; status: string; certificateId: string | null };
export type Certificate = { id: string; number: string; workOrderId: string; status: string; gross: number; retention: number; advanceRecovery: number; net: number; paid: number; outstanding: number; createdAt: string };
export type SummaryRow = { subcontractorId: string; name: string; orderedValue: number; approvedValue: number; pendingWorkValue: number; certifiedGross: number; retentionHeld: number; retentionReleased?: number; advanceBalance: number; paid: number; outstanding: number; uncertifiedApprovedValue: number };

export type RetentionPosition = { agreementId: string; dlpEndsOn: string | null; held: number; released: number; available: number };
export type RetentionRelease = { id: string; number: string; agreementId: string; subcontractorId: string; amount: number; basis: 'dlp_completed' | 'manual'; reason: string; status: string; paid: number; outstanding: number; createdAt: string };
export type RegisterRow = { date: string; type: 'certificate' | 'payment' | 'retention_release'; reference: string; subcontractor: string; gross: number; deductions: number; retention: number; advanceRecovery: number; payable: number; paid: number; balance: number };
export type PaymentRegister = { rows: RegisterRow[]; totals: { gross: number; deductions: number; retention: number; advanceRecovery: number; payable: number; paid: number; balance: number } };

const P = '/subcontract';
export const subcontractApi = {
  subcontractors: () => api<Subcontractor[]>(`${P}/subcontractors`),
  createSubcontractor: (body: { name: string; phone?: string; gstin?: string }) => api<Subcontractor>(`${P}/subcontractors`, { method: 'POST', body }),
  agreements: () => api<Agreement[]>(`${P}/agreements`),
  createAgreement: (body: { subcontractorId: string; projectId: string; title: string; retentionPct?: number; advanceRecoveryPct?: number; dlpEndsOn?: string }) => api<Agreement>(`${P}/agreements`, { method: 'POST', body }),
  workOrders: () => api<WorkOrder[]>(`${P}/work-orders`),
  createWorkOrder: (body: { agreementId: string; lines: { workOrderItemId: string; qty: number; rate: number }[] }) => api<WorkOrder>(`${P}/work-orders`, { method: 'POST', body }),
  progress: (q = '') => api<Progress[]>(`${P}/progress${q}`),
  addProgress: (body: { workOrderId: string; lineId: string; date: string; qty: number; location?: string; remarks?: string }) => api<Progress>(`${P}/progress`, { method: 'POST', body }),
  review: (id: string, action: 'verify' | 'approve' | 'reject', qty?: number, note?: string) => api<Progress>(`${P}/progress/${id}/review`, { method: 'POST', body: { action, qty, note } }),
  certificates: () => api<Certificate[]>(`${P}/certificates`),
  certify: (workOrderId: string) => api<Certificate>(`${P}/certificates`, { method: 'POST', body: { workOrderId } }),
  pay: (id: string, amount: number, reference?: string) => api<Certificate>(`${P}/certificates/${id}/payments`, { method: 'POST', body: { amount, date: new Date().toISOString(), reference } }),
  retention: (agreementId: string) => api<RetentionPosition>(`${P}/agreements/${agreementId}/retention`),
  releases: () => api<RetentionRelease[]>(`${P}/retention-releases`),
  requestRelease: (body: { agreementId: string; amount: number; basis: 'dlp_completed' | 'manual'; reason?: string }) => api<RetentionRelease>(`${P}/retention-releases`, { method: 'POST', body }),
  payRelease: (id: string, amount: number, reference?: string) => api<RetentionRelease>(`${P}/retention-releases/${id}/payments`, { method: 'POST', body: { amount, date: new Date().toISOString(), reference } }),
  register: (subcontractorId = '') => api<PaymentRegister>(`${P}/payment-register${subcontractorId ? `?subcontractorId=${subcontractorId}` : ''}`),
  registerExcel: (subcontractorId = '') => apiBlob(`${P}/payment-register.xlsx${subcontractorId ? `?subcontractorId=${subcontractorId}` : ''}`),
  summary: () => api<{ rows: SummaryRow[]; pendingReview: number }>(`${P}/summary`),
};
