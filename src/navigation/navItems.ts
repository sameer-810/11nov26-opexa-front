import type { User } from '../modules/auth/types';
import { can, canSeeApprovals, PERMS } from '../shared/permissions';
import type { IconName } from '../shared/ui/Icon';
import type { RootStackParamList } from './types';
import { canPayExpenses, canSeeExpenseReport } from '../modules/expense/expenseApi';
import { canSeeActivityLog } from '../modules/activity/activityApi';
import { canSeePayables } from '../modules/supplierPayment/supplierPaymentApi';

export type NavItem = { route: keyof RootStackParamList; label: string; icon: IconName; show: (u: User | null) => boolean; also?: (keyof RootStackParamList)[] };

const any = (u: User | null, perms: string[]) => perms.some((p) => can(u, p));
const always = () => true;
// Who records or follows material received on requests (must match RootNavigator).
export const CHALLAN_VIEWERS = [PERMS.RECEIVING_RECORD, PERMS.STORE_MANAGE, PERMS.PROJECT_MANAGE, PERMS.PURCHASE_MANAGE];

// Sidebar entries. `show` must match the screen registration in RootNavigator.
export const NAV_ITEMS: NavItem[] = [
  { route: 'Dashboard', label: 'Dashboard', icon: 'home', show: always },
  { route: 'Projects', label: 'Projects', icon: 'folder', show: always, also: ['ProjectDetail', 'NewProject', 'EditProject', 'ProjectTeam', 'BoqImport', 'ProjectLots', 'LotDetail', 'MaterialStatus', 'Usage', 'ProjectBilling', 'ProjectFinance', 'ProjectDocuments', 'ProjectMilestones', 'ProjectActivity'] },
  { route: 'Requisitions', label: 'Material requests', icon: 'clipboard', show: always, also: ['NewRequisition', 'RequisitionDetail', 'MaterialReceived'] },
  { route: 'Challans', label: 'Delivery challans', icon: 'receipt', show: (u) => any(u, CHALLAN_VIEWERS), also: ['ChallanDetail'] },
  { route: 'Approvals', label: 'Approvals', icon: 'check', show: canSeeApprovals, also: ['ApprovalSettings', 'Delegations'] },
  { route: 'Procurement', label: 'Procurement', icon: 'cart', show: (u) => can(u, PERMS.PURCHASE_MANAGE), also: ['Rfqs', 'NewRfq', 'RfqDetail', 'RfqComparison', 'SelectionDetail', 'FollowUps', 'PendingQuantities', 'PurchaseOrders', 'PurchaseOrderDetail', 'NewPurchaseOrder', 'Vendors', 'VendorDetail', 'VendorRanking'] },
  { route: 'Store', label: 'Store', icon: 'box', show: (u) => any(u, [PERMS.STORE_MANAGE, PERMS.PURCHASE_MANAGE, PERMS.PROJECT_MANAGE]) },
  { route: 'Invoices', label: 'Invoices', icon: 'receipt', show: (u) => any(u, [PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT]), also: ['InvoiceForm', 'InvoiceDetail'] },
  { route: 'Subcontract', label: 'Subcontractors', icon: 'hardhat', show: (u) => any(u, [PERMS.PROJECT_MANAGE, PERMS.PURCHASE_MANAGE, PERMS.SUPPLIER_INVOICE_VERIFY, PERMS.RECEIVING_RECORD, PERMS.REPORTS_VIEW]) },
  { route: 'Service', label: 'Service & AMC', icon: 'tool', show: always, also: ['TicketDetail', 'NewTicket', 'ServiceAssets', 'HandoverAmc', 'Customers'] },
  { route: 'Sales', label: 'Sales', icon: 'trend', show: (u) => can(u, PERMS.SALES_MANAGE), also: ['NewLead', 'LeadDetail', 'QuoteForm'] },
  { route: 'MyExpenses', label: 'My expenses', icon: 'wallet', show: always, also: ['NewExpense', 'ExpenseForm', 'ExpenseCategories'] },
  { route: 'Payables', label: 'Supplier payables', icon: 'rupee', show: canSeePayables, also: ['SupplierPayments', 'SupplierPaymentForm', 'SupplierPaymentDetail', 'SupplierLedger'] },
  { route: 'ExpensesToPay', label: 'Expenses to pay', icon: 'rupee', show: canPayExpenses },
  { route: 'ExpenseReport', label: 'Expense report', icon: 'funnel', show: canSeeExpenseReport },
  { route: 'Costing', label: 'Costing', icon: 'pie', show: (u) => any(u, [PERMS.PROJECT_MANAGE, PERMS.REPORTS_VIEW]), also: ['ProjectCost'] },
  { route: 'Overview', label: 'Analytics', icon: 'chart', show: (u) => can(u, PERMS.PROJECT_MANAGE) },
  { route: 'ActivityLog', label: 'Activity log', icon: 'shield', show: canSeeActivityLog },
  { route: 'Team', label: 'Team', icon: 'users', show: (u) => can(u, PERMS.TEAM_MANAGE) || can(u, PERMS.TEAM_VIEW), also: ['AddMember', 'MemberDetail'] },
];

export const activeItem = (route: string | undefined) =>
  NAV_ITEMS.find((i) => i.route === route || i.also?.includes(route as keyof RootStackParamList))?.route;
