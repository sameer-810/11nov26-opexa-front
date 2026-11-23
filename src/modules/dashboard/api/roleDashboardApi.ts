import { api } from '../../../shared/api/apiClient';

// 5E / Q28: one dashboard per role; owners and directors may switch between all of them.
export type RoleKey = 'director' | 'project_manager' | 'purchaser' | 'store' | 'accounts' | 'hr' | 'service_head';
export type Kpi = {
  key: string; label: string; value: number; format?: 'money' | 'pct'; sub?: string;
  drill: { screen: string; params?: Record<string, string> };
};
export type DirectorProject = { id: string; code: string; name: string; contract: number; estimatedProfit: number; forecastProfit: number; actualCost: number; billed: number; overrun: boolean };
export type CashWindow = { days: number; receipts: number; payables: number; payroll: number; net: number };
export type RoleDashboard = {
  role: RoleKey; label: string; asOf: string; kpis: Kpi[];
  projects?: (DirectorProject | { id: string; code: string; name: string; installedPct: number })[];
  cashFlow?: CashWindow[];
  notes?: string[];
};
export type RoleList = { default: RoleKey | null; dashboards: { key: RoleKey; label: string }[] };

export const roleDashboardApi = {
  list: () => api<RoleList>('/dashboard/roles'),
  get: (role: RoleKey) => api<RoleDashboard>(`/dashboard/roles/${role}`),
};
