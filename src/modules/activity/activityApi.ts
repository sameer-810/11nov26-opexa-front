import { api } from '../../shared/api/apiClient';
import { can, PERMS } from '../../shared/permissions';
import type { User } from '../auth/types';

export type AuditValue = string | number | boolean | null;
export type ActivityEntry = {
  id: string;
  entityType: string;
  entityId: string;
  entityNumber: string | null;
  action: string;
  projectId: string | null;
  project: { code: string; name: string } | null;
  workOrderItemId: string | null;
  user: { id: string; name: string | null; role: string | null } | null;
  at: string;
  changes: { field: string; old: AuditValue; new: AuditValue }[];
  approvalStatus: string | null;
  approverId: string | null;
  remarks: string | null;
  documentIds: string[];
};
export type ActivityPage = { items: ActivityEntry[]; total: number; page: number; limit: number };
export type ActivityFilters = { projectId?: string; entityType?: string; userId?: string; from?: string; to?: string; page?: number; limit?: number };

// Record types written to the audit log, as people call them.
export const ENTITY_LABEL: Record<string, string> = {
  project: 'Project', boq: 'BOQ', boq_item: 'BOQ item', boq_revision: 'BOQ revision', milestone: 'Milestone', requisition: 'Material request',
  purchase_order: 'Purchase order', rfq: 'RFQ', selection: 'Supplier selection', quote: 'Quotation', supplier_invoice: 'Supplier invoice', vendor: 'Vendor',
  delivery_challan: 'Delivery challan', stock_transfer: 'Stock transfer', stock_adjustment: 'Stock adjustment', material_return: 'Return', over_receipt: 'Over-receipt', stock_damage: 'Damaged stock',
  invoice: 'Invoice', expense: 'Expense', subcontract_certificate: 'Subcontract certificate', amc: 'AMC', asset: 'Equipment', user: 'Team member',
  attendance: 'Attendance', transfer: 'Stock transfer', additional_work: 'Additional work', work_certificate: 'Subcontract certificate', work_order: 'Subcontract work order',
};
export const entityLabel = (t: string) => ENTITY_LABEL[t] ?? t.replace(/_/g, ' ');
export const actionLabel = (a: string) => {
  const t = a.replace(/^approval_/, 'approval ').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Stored field names (projectManagerId, plannedDate…) as people read them: "Project manager", "Planned date".
export const fieldLabel = (f: string) => {
  const t = f.replace(/Id$/, '').replace(/At$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// The company-wide log is for people with audit.view; project members read their project's activity.
export const canSeeActivityLog = (u: User | null | undefined) => can(u, PERMS.AUDIT_VIEW);

const qs = (f: ActivityFilters) => {
  const p = Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

export const activityApi = {
  list: (f: ActivityFilters) => api<ActivityPage>(`/activity${qs(f)}`),
  forEntity: (entityType: string, entityId: string) => api<ActivityEntry[]>(`/activity/${entityType}/${entityId}`),
};
