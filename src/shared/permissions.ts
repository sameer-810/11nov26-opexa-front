import type { User } from '../modules/auth/types';

export const PERMS = {
  TEAM_MANAGE: 'team.manage',
  PROJECT_MANAGE: 'project.manage',
  BOQ_EDIT: 'boq.edit',
  REQUISITION_CREATE: 'requisition.create',
  PURCHASE_MANAGE: 'purchase.manage',
  RECEIVING_RECORD: 'receiving.record',
  ATTENDANCE_SELF: 'attendance.self',
  ATTENDANCE_VIEW: 'attendance.viewAll',
  SETTINGS_MANAGE: 'settings.manage',
  PAYROLL_MANAGE: 'payroll.manage',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_EDIT: 'invoice.edit',
  REPORTS_VIEW: 'reports.view',
  SERVICE_MANAGE: 'service.manage',
  SALES_MANAGE: 'sales.manage',
} as const;

export const can = (user: User | null | undefined, permission: string) => Boolean(user?.permissions?.includes(permission));

export const canEditBoq = (user: User | null | undefined) => can(user, PERMS.BOQ_EDIT) || can(user, PERMS.PROJECT_MANAGE);
