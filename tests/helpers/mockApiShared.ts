// Shared pieces of the fake backend (tests/helpers/mockApi.ts and the route files it uses).
export type Account = {
  id: string;
  companyName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
};

export const ALL = [
  'team.manage', 'settings.manage', 'project.manage', 'boq.edit', 'requisition.create', 'requisition.overrideBoq',
  'purchase.manage', 'receiving.record', 'attendance.self', 'attendance.viewAll', 'payroll.manage',
  'invoice.create', 'invoice.edit', 'reports.view', 'service.manage', 'sales.manage',
];
export const DEFAULTS: Record<string, string[]> = {
  owner: ALL,
  purchaser: ['purchase.manage', 'reports.view', 'attendance.self'],
  engineer: ['requisition.create', 'receiving.record', 'attendance.self', 'service.manage'],
  supervisor: ['receiving.record', 'attendance.self'],
  accounts: ['attendance.viewAll', 'payroll.manage', 'invoice.create', 'invoice.edit', 'reports.view', 'attendance.self'],
  staff: ['attendance.self'],
  store_incharge: ['store.manage', 'receiving.record', 'attendance.self'],
};
export type MockProject = {
  id: string; code: string; name: string; clientName: string; status: string; siteAddress: string | null;
  clientPoNumber: string | null; poDate: null; location: { lat: number; lng: number } | null; geofenceRadiusM: number; memberIds: string[];
};

export const CATALOG = ALL.map((key) => ({ key, group: key.split('.')[0], label: key }));

export const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
export const fail = (status: number, code: string, message: string, details: unknown[] = []) => ({
  ok: false,
  status,
  json: async () => ({ success: false, error: { code, message, details } }),
});
export type Init = { method?: string; body?: string; headers?: Record<string, string> };
