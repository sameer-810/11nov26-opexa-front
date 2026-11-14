import { api } from '../../shared/api/apiClient';

export type CostItem = { workOrderItemId: string; serialNo: string; description: string; unit: string; boqQty: number; boqRate: number; avgCost: number; marginPerUnit: number; lossItem: boolean; netQty: number; materialCost: number; installed: number; installedValue: number };
export type Expense = { id: string; date: string; category: string; amount: number; note: string; billNo: string };
export type Cost = {
  project: { id: string; code: string; name: string; clientName: string; status: string };
  contractValue: number; billed: number; installedValue: number; materialCost: number; labourCost: number; otherCost: number; totalCost: number;
  marginOnBilled: number; marginOnBilledPct: number; marginOnWorkDone: number; marginOnWorkDonePct: number; lossItems: number; peopleWithoutRate: number;
  items?: CostItem[]; labour?: { userId: string; name: string; hours: number; cost: number; hasRate: boolean }[]; expenses?: Expense[];
};

export const costingApi = {
  summary: () => api<Cost[]>('/costing/projects'),
  detail: (id: string) => api<Cost>(`/costing/projects/${id}`),
  addExpense: (id: string, body: { date: string; category: string; amount: number; note?: string; billNo?: string }) => api<Cost>(`/costing/projects/${id}/expenses`, { method: 'POST', body }),
  removeExpense: (id: string, expenseId: string) => api<Cost>(`/costing/projects/${id}/expenses/${expenseId}`, { method: 'DELETE' }),
};
export const CATEGORY_LABEL: Record<string, string> = { transport: 'Transport', hire: 'Equipment hire', 'labour-contract': 'Labour contractor', food: 'Food / stay', consumables: 'Consumables', other: 'Other' };
