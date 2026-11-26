import { api, apiBlob } from '../../../shared/api/apiClient';
import type { Adjustment, DamagedInput, Issue, LedgerRow, Material, MaterialInput, Party, Receiver, Resolution, StockCount, StockLevel, StockRow, Tool, ToolHistory, ToolMaintenance, Transfer, Warehouse, WarehouseInput } from '../types';

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
  createWarehouse: (body: WarehouseInput) => api<Warehouse>('/inventory/warehouses', { method: 'POST', body }),
  updateWarehouse: (id: string, body: Partial<WarehouseInput>) => api<Warehouse>(`/inventory/warehouses/${id}`, { method: 'PATCH', body }),
  stock: (q: { kind?: string; locationId?: string; low?: string } = {}) => api<StockRow[]>(`/inventory/stock${qs(q)}`),
  movements: (q: Record<string, string | undefined> = {}) => api<LedgerRow[]>(`/inventory/movements${qs(q)}`),
  valuation: () => api<{ locations: { location: { kind: string; id: string; name: string }; items: number; value: number }[]; total: number }>('/inventory/reports/valuation'),
  reconciliation: () => api<{ ok: boolean; checked: number; mismatches: unknown[]; negatives: unknown[] }>('/inventory/reconciliation'),
  transfers: (q: { status?: string; projectId?: string } = {}) => api<Transfer[]>(`/inventory/transfers${qs(q)}`),
  createTransfer: (body: { fromWarehouseId: string; to: Loc; reason?: string; lines: LineIn[] }) => api<Transfer>('/inventory/transfers', { method: 'POST', body }),
  receivers: (id: string) => api<Receiver[]>(`/inventory/transfers/${id}/receivers`),
  confirm: (id: string, body: { note?: string; lines: { lineId: string; accepted: number; damaged: number; short: number }[] }) => api<Transfer>(`/inventory/transfers/${id}/confirm`, { method: 'POST', body }),
  resolve: (id: string, body: { remarks: string; lines: { lineId: string; action: Resolution }[] }) => api<Transfer>(`/inventory/transfers/${id}/resolve`, { method: 'POST', body }),
  dispatch: (id: string, body: { vehicleNo?: string; receiverId?: string } = {}) => api<Transfer>(`/inventory/transfers/${id}/dispatch`, { method: 'POST', body }),
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
  tools: (q: { status?: string; q?: string; due?: 'service' } = {}) => api<Tool[]>(`/inventory/tools${qs(q)}`),
  tool: (id: string) => api<ToolHistory>(`/inventory/tools/${id}`),
  createTool: (body: { name: string; serialNo?: string; category?: string }) => api<Tool>('/inventory/tools', { method: 'POST', body }),
  issueTool: (id: string, body: { holder: Party; projectId?: string; expectedReturn?: string; condition?: 'good' | 'fair' | 'needs_repair'; note?: string }) => api<Tool>(`/inventory/tools/${id}/issue`, { method: 'POST', body }),
  returnTool: (id: string, condition: 'good' | 'fair' | 'needs_repair' | 'damaged', extra: { returnedAt?: string; remarks?: string } = {}) => api<Tool>(`/inventory/tools/${id}/return`, { method: 'POST', body: { condition, ...extra } }),
  toolStatus: (id: string, action: 'missing' | 'damaged' | 'scrapped' | 'found', note: string, extra: { responsible?: Party; recoveryAmount?: number } = {}) => api<Tool>(`/inventory/tools/${id}/status`, { method: 'POST', body: { action, note, ...extra } }),
  sendForRepair: (id: string, body: { vendor?: string; notes?: string; date?: string; projectId?: string }) => api<Tool>(`/inventory/tools/${id}/repair`, { method: 'POST', body }),
  markRepaired: (id: string, body: { cost?: number; vendor?: string; notes?: string; date?: string; nextDueDate?: string; projectId?: string }) => api<Tool>(`/inventory/tools/${id}/repaired`, { method: 'POST', body }),
  addMaintenance: (id: string, body: { type: 'repair' | 'service' | 'calibration'; cost?: number; vendor?: string; notes?: string; date?: string; nextDueDate?: string; projectId?: string }) => api<ToolMaintenance>(`/inventory/tools/${id}/maintenance`, { method: 'POST', body }),
  counts: (q: { status?: string; kind?: string } = {}) => api<StockCount[]>(`/inventory/counts${qs(q)}`),
  count: (id: string) => api<StockCount>(`/inventory/counts/${id}`),
  startCount: (body: { location: Loc; countDate?: string; scope?: { type: 'all' | 'category' | 'selected'; category?: string; materialIds?: string[] }; note?: string }) => api<StockCount>('/inventory/counts', { method: 'POST', body }),
  // rate: only for lines with no known rate (systemRate 0); 0 clears an entered rate.
  saveCount: (id: string, lines: { materialId: string; countedQty: number; damagedQty?: number; rate?: number; reason?: string }[]) => api<StockCount>(`/inventory/counts/${id}/lines`, { method: 'PUT', body: { lines } }),
  submitCount: (id: string) => api<StockCount>(`/inventory/counts/${id}/submit`, { method: 'POST' }),
  cancelCount: (id: string, reason: string) => api<StockCount>(`/inventory/counts/${id}/cancel`, { method: 'POST', body: { reason } }),
  countExcel: (id: string) => apiBlob(`/inventory/counts/${id}/report.xlsx`),
  stockLevels: (q: { kind?: string; locationId?: string } = {}) => api<StockLevel[]>(`/inventory/stock-levels${qs(q)}`),
  saveStockLevel: (body: { materialId: string; location: Loc; minQty: number | null; reorderQty?: number }) => api<StockLevel>('/inventory/stock-levels', { method: 'PUT', body }),
};
