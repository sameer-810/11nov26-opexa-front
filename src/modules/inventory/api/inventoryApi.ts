import { api } from '../../../shared/api/apiClient';
import type { Adjustment, DamagedInput, Issue, LedgerRow, Material, MaterialInput, StockRow, Tool, Transfer, Warehouse } from '../types';

const qs = (q: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  return p ? `?${p}` : '';
};
type Loc = { kind: 'warehouse' | 'site'; id: string };
type LineIn = { materialId?: string; workOrderItemId?: string; billable?: boolean; qty: number };

export const inventoryApi = {
  materials: (q: { q?: string; verification?: 'pending' } = {}) => api<Material[]>(`/inventory/materials${qs(q)}`),
  // Without store/purchase rights the material is saved as "new – verify" for the purchaser.
  createMaterial: (body: MaterialInput) => api<Material>('/inventory/materials', { method: 'POST', body }),
  verifyMaterial: (id: string, body: Partial<Pick<MaterialInput, 'name' | 'unit' | 'category'>> = {}) => api<Material>(`/inventory/materials/${id}/verify`, { method: 'POST', body }),
  mergeMaterial: (id: string, intoId: string) => api<Material>(`/inventory/materials/${id}/merge`, { method: 'POST', body: { intoId } }),
  updateMaterial: (id: string, body: Partial<Material>) => api<Material>(`/inventory/materials/${id}`, { method: 'PATCH', body }),
  warehouses: () => api<Warehouse[]>('/inventory/warehouses'),
  createWarehouse: (body: { name: string; address?: string }) => api<Warehouse>('/inventory/warehouses', { method: 'POST', body }),
  stock: (q: { kind?: string; locationId?: string; low?: string } = {}) => api<StockRow[]>(`/inventory/stock${qs(q)}`),
  movements: (q: Record<string, string | undefined> = {}) => api<LedgerRow[]>(`/inventory/movements${qs(q)}`),
  valuation: () => api<{ locations: { location: { kind: string; id: string; name: string }; items: number; value: number }[]; total: number }>('/inventory/reports/valuation'),
  reconciliation: () => api<{ ok: boolean; checked: number; mismatches: unknown[]; negatives: unknown[] }>('/inventory/reconciliation'),
  transfers: (q: { status?: string; projectId?: string } = {}) => api<Transfer[]>(`/inventory/transfers${qs(q)}`),
  createTransfer: (body: { fromWarehouseId: string; to: Loc; reason?: string; lines: LineIn[] }) => api<Transfer>('/inventory/transfers', { method: 'POST', body }),
  dispatch: (id: string, body: { vehicleNo?: string } = {}) => api<Transfer>(`/inventory/transfers/${id}/dispatch`, { method: 'POST', body }),
  receive: (id: string, lines: { lineId: string; qty: number }[]) => api<Transfer>(`/inventory/transfers/${id}/receive`, { method: 'POST', body: { lines } }),
  closeTransfer: (id: string, reason: string) => api<Transfer>(`/inventory/transfers/${id}/close`, { method: 'POST', body: { reason } }),
  issues: (q: { projectId?: string; status?: string } = {}) => api<Issue[]>(`/inventory/issues${qs(q)}`),
  createIssue: (body: { from: Loc; issuedTo: { kind: 'subcontractor' | 'employee' | 'other'; name: string; refId?: string }; purpose?: string; lines: LineIn[] }) => api<Issue>('/inventory/issues', { method: 'POST', body }),
  settleIssue: (id: string, action: 'return' | 'consume', lines: { lineId: string; qty: number }[]) => api<Issue>(`/inventory/issues/${id}/settle`, { method: 'POST', body: { action, lines } }),
  adjustments: (q: { status?: string } = {}) => api<Adjustment[]>(`/inventory/adjustments${qs(q)}`),
  createAdjustment: (body: { location: Loc; reason: string; lines: (Omit<LineIn, 'qty'> & { physicalQty: number })[] }) => api<Adjustment>('/inventory/adjustments', { method: 'POST', body }),
  decideAdjustment: (id: string, decision: 'approved' | 'rejected', note?: string) => api<Adjustment>(`/inventory/adjustments/${id}/decision`, { method: 'POST', body: { decision, note } }),
  markDamaged: (body: DamagedInput) => api<{ id: string; number: string }>('/inventory/damaged/mark', { method: 'POST', body }),
  writeOffDamaged: (body: DamagedInput) => api<{ id: string; number: string; status: string }>('/inventory/damaged/write-off', { method: 'POST', body }),
  returnDamaged: (body: DamagedInput) => api<{ id: string; number: string }>('/inventory/damaged/return', { method: 'POST', body }),
  settings: () => api<{ overReceiptTolerancePercent: number }>('/inventory/settings'),
  saveSettings: (body: { overReceiptTolerancePercent: number }) => api<{ overReceiptTolerancePercent: number }>('/inventory/settings', { method: 'PUT', body }),
  tools: (q: { status?: string; q?: string } = {}) => api<Tool[]>(`/inventory/tools${qs(q)}`),
  createTool: (body: { name: string; serialNo?: string; category?: string }) => api<Tool>('/inventory/tools', { method: 'POST', body }),
  issueTool: (id: string, body: { holder: { kind: 'employee' | 'subcontractor' | 'other'; name: string }; projectId?: string; expectedReturn?: string }) => api<Tool>(`/inventory/tools/${id}/issue`, { method: 'POST', body }),
  returnTool: (id: string, condition: 'good' | 'needs_repair' | 'damaged', note?: string) => api<Tool>(`/inventory/tools/${id}/return`, { method: 'POST', body: { condition, note } }),
  toolStatus: (id: string, action: 'missing' | 'scrapped' | 'found', note: string) => api<Tool>(`/inventory/tools/${id}/status`, { method: 'POST', body: { action, note } }),
};
