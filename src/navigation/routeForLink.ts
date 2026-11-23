import type { User } from '../modules/auth/types';
import { can, canSeeApprovals, PERMS } from '../shared/permissions';
import type { RootStackParamList } from './types';
import { canPayExpenses } from '../modules/expense/expenseApi';
import { canSeePayables } from '../modules/supplierPayment/supplierPaymentApi';

export type RouteTarget = { [K in keyof RootStackParamList]: { name: K; params: RootStackParamList[K] } }[keyof RootStackParamList];

// Turns a notification link (from the API) into an app screen. Shared by the
// notifications list and by tapping a phone push. Unknown links return null.
export function routeForLink(link: string | null | undefined, user: User | null): RouteTarget | null {
  const l = link ?? '';
  let m: RegExpMatchArray | null;
  if ((m = l.match(/^\/app\/requisitions\/([^/]+)$/))) return { name: 'RequisitionDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([^/]+)\/lots\/([^/]+)$/))) return { name: 'LotDetail', params: { projectId: m[1], lotId: m[2] } };
  if ((m = l.match(/^\/app\/projects\/([^/]+)\/material$/))) return { name: 'MaterialStatus', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/returns\/([^/]+)$/))) return { name: 'ReturnDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/delivery-challans\/([a-f0-9]{24})$/))) return { name: 'ChallanDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([^/]+)\/stock-counts\/([^/]+)$/))) return { name: 'StockCount', params: { id: m[1], countId: m[2] } };
  if ((m = l.match(/^\/app\/purchase-orders\/([^/]+)$/)) && can(user, PERMS.PURCHASE_MANAGE)) return { name: 'PurchaseOrderDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/rfqs\/([a-f0-9]{24})$/)) && can(user, PERMS.PURCHASE_MANAGE)) return { name: 'RfqDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/selections\/([a-f0-9]{24})$/)) && can(user, PERMS.PURCHASE_MANAGE)) return { name: 'SelectionDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/supplier-invoices\/([a-f0-9]{24})$/)) && (can(user, PERMS.PURCHASE_MANAGE) || can(user, PERMS.SUPPLIER_INVOICE_VERIFY))) return { name: 'SupplierInvoiceDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/vendors\/([a-f0-9]{24})$/)) && can(user, PERMS.PURCHASE_MANAGE)) return { name: 'VendorDetail', params: { id: m[1] } };
  if (l.startsWith('/app/store') && (can(user, PERMS.STORE_MANAGE) || can(user, PERMS.PURCHASE_MANAGE) || can(user, PERMS.PROJECT_MANAGE))) return { name: 'Store', params: undefined };
  if (/^\/app\/approvals(\/[a-f0-9]{24})?$/.test(l) && canSeeApprovals(user)) return { name: 'Approvals', params: undefined };
  if (l === '/app/subcontract') return { name: 'Subcontract', params: undefined };
  if (l === '/app/commitments') return { name: 'Commitments', params: undefined };
  if (l === '/app/procurement' && can(user, PERMS.PURCHASE_MANAGE)) return { name: 'Procurement', params: undefined };
  if ((m = l.match(/^\/app\/service\/([a-f0-9]{24})$/))) return { name: 'TicketDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/sales\/([a-f0-9]{24})$/)) && can(user, PERMS.SALES_MANAGE)) return { name: 'LeadDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([a-f0-9]{24})$/))) return { name: 'ProjectDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([a-f0-9]{24})\/milestones$/))) return { name: 'ProjectMilestones', params: { id: m[1] } };
  if (l === '/app/service') return { name: 'Service', params: undefined };
  // 5D drive: sources of transaction attachments (same permission rules as the screens are registered with).
  if ((m = l.match(/^\/app\/projects\/([a-f0-9]{24})\/billing$/)) && [PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.PROJECT_MANAGE, PERMS.RECEIVING_RECORD].some((p) => can(user, p))) return { name: 'ProjectBilling', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([a-f0-9]{24})\/finance$/)) && (can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW))) return { name: 'ProjectFinance', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/projects\/([a-f0-9]{24})\/handover$/)) && [PERMS.PROJECT_MANAGE, PERMS.SERVICE_MANAGE, PERMS.SERVICE_VIEW, PERMS.PROJECT_VIEW].some((p) => can(user, p))) return { name: 'HandoverAmc', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/invoices\/([a-f0-9]{24})$/)) && (can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT))) return { name: 'InvoiceDetail', params: { id: m[1] } };
  if ((m = l.match(/^\/app\/supplier-payments\/([a-f0-9]{24})$/)) && canSeePayables(user)) return { name: 'SupplierPaymentDetail', params: { id: m[1] } };
  if (l === '/app/expenses/to-pay' && canPayExpenses(user)) return { name: 'ExpensesToPay', params: undefined };
  if ((m = l.match(/^\/app\/expenses\/([a-f0-9]{24})$/))) return { name: 'ExpenseForm', params: { id: m[1] } };
  if (l === '/app/payslips') return { name: 'Payslips', params: undefined };
  if (l === '/app/attendance' && can(user, PERMS.ATTENDANCE_SELF)) return { name: 'Attendance', params: undefined };
  if ((m = l.match(/^\/app\/attendance\/team(?:\?date=(\d{4}-\d{2}-\d{2}))?$/)) && can(user, PERMS.ATTENDANCE_VIEW)) return { name: 'TeamAttendance', params: m[1] ? { date: m[1] } : undefined };
  return null;
}
