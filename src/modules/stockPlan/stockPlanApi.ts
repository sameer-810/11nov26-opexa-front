import { api } from '../../shared/api/apiClient';
import type { Transfer } from '../inventory/types';

// Stock availability on a material request and the purchaser's "Reserve & issue plan" (Q13).
export type WarehouseStock = { warehouseId: string; name: string; onHand: number; reserved: number; available: number };
export type Reservation = {
  id: string; warehouseId: string; warehouseName: string; qty: number; status: 'active' | 'transferred' | 'released';
  transferId: string | null; transferNumber: string | null; releaseReason: string;
};
export type StockPlanLine = {
  requisitionLineId: string; serialNo: string; description: string; unit: string; materialId: string | null;
  stockLink: boolean; // false: BOQ line not linked to a stock material
  requested: number; ordered: number; receivedDirect: number; fromStock: number; need: number;
  warehouses: WarehouseStock[]; available: number; plan: { warehouseId: string; name: string; qty: number }[];
  toIssue: number; toPurchase: number; otherSites: { projectId: string; name: string; qty: number }[]; reservations: Reservation[];
};
export type StockPlan = {
  requisitionId: string; status: string; canPlan: boolean; lines: StockPlanLine[];
  totals: { toIssue: number; toPurchase: number; activeReservations: number };
};

export const stockPlanApi = {
  get: (requisitionId: string) => api<StockPlan>(`/requisitions/${requisitionId}/stock-plan`),
  reserve: (requisitionId: string) => api<StockPlan>(`/requisitions/${requisitionId}/stock-plan/reserve`, { method: 'POST', body: {} }),
  transfer: (requisitionId: string) => api<{ transfers: Transfer[]; plan: StockPlan }>(`/requisitions/${requisitionId}/stock-plan/transfer`, { method: 'POST', body: {} }),
  release: (reservationId: string, reason: string) => api<StockPlan>(`/requisitions/stock-reservations/${reservationId}/release`, { method: 'POST', body: { reason } }),
};
