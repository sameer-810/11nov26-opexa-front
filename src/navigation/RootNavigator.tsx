import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PROTECTED_ROUTES, type NavMode, type RootStackParamList } from './types';
import { useAuth } from '../shared/store/useAuthStore';
import { can, canSeeApprovals, PERMS } from '../shared/permissions';
import { colors } from '../shared/designSystem';
import { LandingScreen } from '../modules/landing/screens/LandingScreen';
import { SignInScreen } from '../modules/auth/screens/SignInScreen';
import { DashboardScreen } from '../modules/dashboard/screens/DashboardScreen';
import { TeamScreen } from '../modules/team/screens/TeamScreen';
import { AddMemberScreen } from '../modules/team/screens/AddMemberScreen';
import { MemberDetailScreen } from '../modules/team/screens/MemberDetailScreen';
import { ChangePasswordScreen } from '../modules/profile/screens/ChangePasswordScreen';
import { ProjectsScreen } from '../modules/project/screens/ProjectsScreen';
import { ProjectFormScreen } from '../modules/project/screens/ProjectFormScreen';
import { ProjectDetailScreen } from '../modules/project/screens/ProjectDetailScreen';
import { ProjectTeamScreen } from '../modules/project/screens/ProjectTeamScreen';
import { ProjectSitesScreen } from '../modules/project/screens/ProjectSitesScreen';
import { BoqImportScreen } from '../modules/project/screens/BoqImportScreen';
import { canEditBoq } from '../shared/permissions';
import { RequisitionsScreen } from '../modules/requisition/screens/RequisitionsScreen';
import { NewRequisitionScreen } from '../modules/requisition/screens/NewRequisitionScreen';
import { RequisitionDetailScreen } from '../modules/requisition/screens/RequisitionDetailScreen';
import { NotificationsScreen } from '../modules/notification/screens/NotificationsScreen';
import { ApprovalsScreen } from '../modules/approval/screens/ApprovalsScreen';
import { ApprovalSettingsScreen } from '../modules/approval/screens/ApprovalSettingsScreen';
import { DelegationsScreen } from '../modules/approval/screens/DelegationsScreen';
import { VendorsScreen } from '../modules/vendor/screens/VendorsScreen';
import { PurchaseOrdersScreen } from '../modules/purchaseOrder/screens/PurchaseOrdersScreen';
import { ProcurementDashboardScreen } from '../modules/procurement/screens/ProcurementDashboardScreen';
import { PendingQuantitiesScreen } from '../modules/procurement/screens/PendingQuantitiesScreen';
import { RfqsScreen } from '../modules/procurement/screens/RfqsScreen';
import { NewRfqScreen } from '../modules/procurement/screens/NewRfqScreen';
import { RfqDetailScreen } from '../modules/procurement/screens/RfqDetailScreen';
import { RfqComparisonScreen } from '../modules/procurement/screens/RfqComparisonScreen';
import { SelectionDetailScreen } from '../modules/procurement/screens/SelectionDetailScreen';
import { FollowUpsScreen } from '../modules/procurement/screens/FollowUpsScreen';
import { SupplierInvoicesScreen } from '../modules/procurement/screens/SupplierInvoicesScreen';
import { SupplierInvoiceDetailScreen } from '../modules/procurement/screens/SupplierInvoiceDetailScreen';
import { StoreScreen } from '../modules/inventory/screens/StoreScreen';
import { ProjectFinanceScreen } from '../modules/projectFinance/ProjectFinanceScreen';
import { SubcontractScreen } from '../modules/subcontract/SubcontractScreen';
import { ProjectBillingScreen } from '../modules/billing/ProjectBillingScreen';
import { CommitmentsScreen } from '../modules/commitments/CommitmentsScreen';
import { ProjectDocumentsScreen } from '../modules/documents/ProjectDocumentsScreen';
import { QuantityViewScreen } from '../modules/project/screens/QuantityViewScreen';
import { HandoverAmcScreen } from '../modules/service/screens/HandoverAmcScreen';
import { TallyScreen } from '../modules/tally/TallyScreen';
import { NotesScreen } from '../modules/receivables/NotesScreen';
import { ClientReceiptsScreen } from '../modules/receivables/ClientReceiptsScreen';
import { ClientLedgerScreen } from '../modules/receivables/ClientLedgerScreen';
import { MyExpensesScreen } from '../modules/expense/screens/MyExpensesScreen';
import { ExpenseFormScreen } from '../modules/expense/screens/ExpenseFormScreen';
import { ExpensesToPayScreen } from '../modules/expense/screens/ExpensesToPayScreen';
import { ExpenseReportScreen } from '../modules/expense/screens/ExpenseReportScreen';
import { ProjectMilestonesScreen } from '../modules/project/screens/ProjectMilestonesScreen';
import { ProjectActivityScreen } from '../modules/activity/ProjectActivityScreen';
import { ActivityLogScreen } from '../modules/activity/ActivityLogScreen';
import { canSeeActivityLog } from '../modules/activity/activityApi';
import { AttendanceReportScreen } from '../modules/attendance/screens/AttendanceReportScreen';
import { ExpenseCategoriesScreen } from '../modules/expense/screens/ExpenseCategoriesScreen';
import { canPayExpenses, canSeeExpenseReport } from '../modules/expense/expenseApi';
import { NewPurchaseOrderScreen } from '../modules/purchaseOrder/screens/NewPurchaseOrderScreen';
import { PurchaseOrderDetailScreen } from '../modules/purchaseOrder/screens/PurchaseOrderDetailScreen';
import { ProjectLotsScreen } from '../modules/purchaseOrder/screens/ProjectLotsScreen';
import { LotDetailScreen } from '../modules/receiving/screens/LotDetailScreen';
import { MaterialStatusScreen } from '../modules/receiving/screens/MaterialStatusScreen';
import { LocalPurchasesScreen } from '../modules/receiving/screens/LocalPurchasesScreen';
import { UsageScreen } from '../modules/material/screens/UsageScreen';
import { ReturnsScreen } from '../modules/material/screens/ReturnsScreen';
import { NewReturnScreen } from '../modules/material/screens/NewReturnScreen';
import { ReturnDetailScreen } from '../modules/material/screens/ReturnDetailScreen';
import { StockCountScreen } from '../modules/material/screens/StockCountScreen';
import { OverviewScreen } from '../modules/dashboard/screens/OverviewScreen';
import { OutboxScreen } from '../modules/profile/OutboxScreen';
import { AttendanceScreen } from '../modules/attendance/screens/AttendanceScreen';
import { TeamAttendanceScreen } from '../modules/attendance/screens/TeamAttendanceScreen';
import { PayrollScreen } from '../modules/payroll/screens/PayrollScreen';
import { PayrollRunScreen } from '../modules/payroll/screens/PayrollRunScreen';
import { PayrollPeopleScreen } from '../modules/payroll/screens/PayrollPeopleScreen';
import { MyPayslipsScreen } from '../modules/payroll/screens/MyPayslipsScreen';
import { InvoicesScreen } from '../modules/invoice/screens/InvoicesScreen';
import { InvoiceFormScreen } from '../modules/invoice/screens/InvoiceFormScreen';
import { InvoiceDetailScreen } from '../modules/invoice/screens/InvoiceDetailScreen';
import { CostingScreen } from '../modules/costing/CostingScreen';
import { ProjectCostScreen } from '../modules/costing/ProjectCostScreen';
import { ServiceScreen } from '../modules/service/screens/ServiceScreen';
import { NewTicketScreen } from '../modules/service/screens/NewTicketScreen';
import { TicketDetailScreen } from '../modules/service/screens/TicketDetailScreen';
import { AssetsScreen } from '../modules/service/screens/AssetsScreen';
import { CustomersScreen } from '../modules/service/screens/CustomersScreen';
import { SalesScreen } from '../modules/sales/screens/SalesScreen';
import { NewLeadScreen } from '../modules/sales/screens/NewLeadScreen';
import { LeadDetailScreen } from '../modules/sales/screens/LeadDetailScreen';
import { QuoteFormScreen } from '../modules/sales/screens/QuoteFormScreen';
import { MaterialReceivedScreen } from '../modules/deliveryChallan/screens/MaterialReceivedScreen';
import { ChallansScreen } from '../modules/deliveryChallan/screens/ChallansScreen';
import { ChallanDetailScreen } from '../modules/deliveryChallan/screens/ChallanDetailScreen';
import { CHALLAN_VIEWERS } from './navItems';
import { RedirectToSignIn } from './RedirectToSignIn';
import { canPaySuppliers, canSeePayables } from '../modules/supplierPayment/supplierPaymentApi';
import { PayablesScreen } from '../modules/supplierPayment/screens/PayablesScreen';
import { SupplierPaymentsScreen } from '../modules/supplierPayment/screens/SupplierPaymentsScreen';
import { SupplierPaymentFormScreen } from '../modules/supplierPayment/screens/SupplierPaymentFormScreen';
import { SupplierPaymentDetailScreen } from '../modules/supplierPayment/screens/SupplierPaymentDetailScreen';
import { SupplierLedgerScreen } from '../modules/supplierPayment/screens/SupplierLedgerScreen';
import { VendorDetailScreen } from '../modules/vendor/screens/VendorDetailScreen';
import { VendorRankingScreen } from '../modules/vendor/screens/VendorRankingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = { headerShown: false, contentStyle: { backgroundColor: colors.surface } };
const glassOptions = { headerShown: false, contentStyle: { backgroundColor: 'transparent' } };

// Signed out: landing (web only) -> sign in / sign up. Any /app/... link redirects to sign in.
// Signed in with a temporary password: only "Set your password".
// Signed in: the app; screens the user has no permission for are not registered at all.
export function RootNavigator({ showLanding = Platform.OS === 'web', transparent = false }: { showLanding?: boolean; transparent?: boolean }) {
  const { isSignedIn, user } = useAuth();

  if (isSignedIn && user?.mustChangePassword) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="SetPassword" component={ChangePasswordScreen} options={{ title: 'Opexa - Set your password' }} />
      </Stack.Navigator>
    );
  }

  if (isSignedIn) {
    const manageTeam = can(user, PERMS.TEAM_MANAGE);
    const manageProjects = can(user, PERMS.PROJECT_MANAGE);
    const editBoq = canEditBoq(user);
    return (
      <Stack.Navigator initialRouteName="Dashboard" screenOptions={transparent ? glassOptions : screenOptions}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Opexa - Dashboard' }} />
        {(manageTeam || can(user, PERMS.TEAM_VIEW)) && <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Opexa - Team' }} />}
        {manageTeam && <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Opexa - Add member' }} />}
        {manageTeam && <Stack.Screen name="MemberDetail" component={MemberDetailScreen} options={{ title: 'Opexa - Team member' }} />}
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Opexa - Change password' }} />
        <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Opexa - Projects' }} />
        {manageProjects && <Stack.Screen name="NewProject" component={ProjectFormScreen} options={{ title: 'Opexa - New project' }} />}
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Opexa - Project' }} />
        {manageProjects && <Stack.Screen name="EditProject" component={ProjectFormScreen} options={{ title: 'Opexa - Edit project' }} />}
        {manageProjects && <Stack.Screen name="ProjectTeam" component={ProjectTeamScreen} options={{ title: 'Opexa - Project team' }} />}
        <Stack.Screen name="ProjectSites" component={ProjectSitesScreen} options={{ title: 'Opexa - Sites' }} />
        {editBoq && <Stack.Screen name="BoqImport" component={BoqImportScreen} options={{ title: 'Opexa - Import BOQ' }} />}
        <Stack.Screen name="Requisitions" component={RequisitionsScreen} options={{ title: 'Opexa - Material requests' }} />
        {can(user, PERMS.REQUISITION_CREATE) && <Stack.Screen name="NewRequisition" component={NewRequisitionScreen} options={{ title: 'Opexa - New material request' }} />}
        <Stack.Screen name="RequisitionDetail" component={RequisitionDetailScreen} options={{ title: 'Opexa - Material request' }} />
        {[PERMS.RECEIVING_RECORD, PERMS.STORE_MANAGE, PERMS.PROJECT_MANAGE].some((p) => can(user, p)) && <Stack.Screen name="MaterialReceived" component={MaterialReceivedScreen} options={{ title: 'Opexa - Material received' }} />}
        {CHALLAN_VIEWERS.some((p) => can(user, p)) && <Stack.Screen name="Challans" component={ChallansScreen} options={{ title: 'Opexa - Delivery challans' }} />}
        <Stack.Screen name="ChallanDetail" component={ChallanDetailScreen} options={{ title: 'Opexa - Delivery challan' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Opexa - Notifications' }} />
        {canSeeApprovals(user) && <Stack.Screen name="Approvals" component={ApprovalsScreen} options={{ title: 'Opexa - My approvals' }} />}
        {canSeeApprovals(user) && <Stack.Screen name="Delegations" component={DelegationsScreen} options={{ title: 'Opexa - Delegate approvals' }} />}
        {can(user, PERMS.APPROVAL_MANAGE) && <Stack.Screen name="ApprovalSettings" component={ApprovalSettingsScreen} options={{ title: 'Opexa - Approval settings' }} />}
        <Stack.Screen name="ProjectLots" component={ProjectLotsScreen} options={{ title: 'Opexa - Deliveries' }} />
        <Stack.Screen name="LotDetail" component={LotDetailScreen} options={{ title: 'Opexa - Lot' }} />
        <Stack.Screen name="MaterialStatus" component={MaterialStatusScreen} options={{ title: 'Opexa - Material status' }} />
        <Stack.Screen name="LocalPurchases" component={LocalPurchasesScreen} options={{ title: 'Opexa - Local purchase' }} />
        <Stack.Screen name="Usage" component={UsageScreen} options={{ title: 'Opexa - Installation log' }} />
        <Stack.Screen name="Returns" component={ReturnsScreen} options={{ title: 'Opexa - Returns' }} />
        <Stack.Screen name="ProjectReturns" component={ReturnsScreen} options={{ title: 'Opexa - Returns' }} />
        <Stack.Screen name="NewReturn" component={NewReturnScreen} options={{ title: 'Opexa - Send material back' }} />
        <Stack.Screen name="ReturnDetail" component={ReturnDetailScreen} options={{ title: 'Opexa - Return' }} />
        <Stack.Screen name="StockCount" component={StockCountScreen} options={{ title: 'Opexa - Stock count' }} />
        <Stack.Screen name="Outbox" component={OutboxScreen} options={{ title: 'Opexa - Saved on this device' }} />
        {can(user, PERMS.ATTENDANCE_SELF) && <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Opexa - Attendance' }} />}
        {(can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT)) && <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'Opexa - Invoices' }} />}
        {(can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT)) && <Stack.Screen name="InvoiceForm" component={InvoiceFormScreen} options={{ title: 'Opexa - Invoice' }} />}
        {(can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT)) && <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Opexa - Invoice' }} />}
        {(can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW)) && <Stack.Screen name="Costing" component={CostingScreen} options={{ title: 'Opexa - Project costing' }} />}
        {(can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW)) && <Stack.Screen name="ProjectCost" component={ProjectCostScreen} options={{ title: 'Opexa - Costing' }} />}
        <Stack.Screen name="Service" component={ServiceScreen} options={{ title: 'Opexa - Service' }} />
        <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Opexa - Service job' }} />
        {can(user, PERMS.SERVICE_MANAGE) && <Stack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: 'Opexa - New complaint' }} />}
        {can(user, PERMS.SERVICE_MANAGE) && <Stack.Screen name="ServiceAssets" component={AssetsScreen} options={{ title: 'Opexa - Equipment' }} />}
        {[PERMS.SERVICE_MANAGE, PERMS.SERVICE_VIEW, PERMS.PROJECT_MANAGE, PERMS.PROJECT_VIEW, PERMS.SALES_MANAGE].some((p) => can(user, p)) && <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Opexa - Customers' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="Sales" component={SalesScreen} options={{ title: 'Opexa - Sales' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="NewLead" component={NewLeadScreen} options={{ title: 'Opexa - New enquiry' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Opexa - Enquiry' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="QuoteForm" component={QuoteFormScreen} options={{ title: 'Opexa - Quotation' }} />}
        <Stack.Screen name="Payslips" component={MyPayslipsScreen} options={{ title: 'Opexa - My payslips' }} />
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="Payroll" component={PayrollScreen} options={{ title: 'Opexa - Payroll' }} />}
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="PayrollRun" component={PayrollRunScreen} options={{ title: 'Opexa - Payroll' }} />}
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="PayrollPeople" component={PayrollPeopleScreen} options={{ title: 'Opexa - Pay rates' }} />}
        {can(user, PERMS.ATTENDANCE_VIEW) && <Stack.Screen name="TeamAttendance" component={TeamAttendanceScreen} options={{ title: 'Opexa - Team attendance' }} />}
        {can(user, PERMS.ATTENDANCE_VIEW) && <Stack.Screen name="AttendanceReport" component={AttendanceReportScreen} options={{ title: 'Opexa - Attendance report' }} />}
        <Stack.Screen name="ProjectMilestones" component={ProjectMilestonesScreen} options={{ title: 'Opexa - Schedule' }} />
        <Stack.Screen name="ProjectActivity" component={ProjectActivityScreen} options={{ title: 'Opexa - Project activity' }} />
        {canSeeActivityLog(user) && <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: 'Opexa - Activity log' }} />}
        {can(user, PERMS.PROJECT_MANAGE) && <Stack.Screen name="Overview" component={OverviewScreen} options={{ title: 'Opexa - Business overview' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="Vendors" component={VendorsScreen} options={{ title: 'Opexa - Vendors' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Opexa - Supplier' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="VendorRanking" component={VendorRankingScreen} options={{ title: 'Opexa - Supplier performance' }} />}
        {canSeePayables(user) && <Stack.Screen name="Payables" component={PayablesScreen} options={{ title: 'Opexa - Supplier payables' }} />}
        {canSeePayables(user) && <Stack.Screen name="SupplierPayments" component={SupplierPaymentsScreen} options={{ title: 'Opexa - Supplier payments' }} />}
        {canSeePayables(user) && <Stack.Screen name="SupplierPaymentDetail" component={SupplierPaymentDetailScreen} options={{ title: 'Opexa - Supplier payment' }} />}
        {canSeePayables(user) && <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} options={{ title: 'Opexa - Supplier ledger' }} />}
        {canPaySuppliers(user) && <Stack.Screen name="SupplierPaymentForm" component={SupplierPaymentFormScreen} options={{ title: 'Opexa - Supplier payment' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} options={{ title: 'Opexa - Purchase orders' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="NewPurchaseOrder" component={NewPurchaseOrderScreen} options={{ title: 'Opexa - New purchase order' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} options={{ title: 'Opexa - Purchase order' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="Procurement" component={ProcurementDashboardScreen} options={{ title: 'Opexa - Procurement' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="PendingQuantities" component={PendingQuantitiesScreen} options={{ title: 'Opexa - Pending quantities' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="Rfqs" component={RfqsScreen} options={{ title: 'Opexa - RFQs' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="NewRfq" component={NewRfqScreen} options={{ title: 'Opexa - Request quotations' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="RfqDetail" component={RfqDetailScreen} options={{ title: 'Opexa - RFQ' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="RfqComparison" component={RfqComparisonScreen} options={{ title: 'Opexa - Comparative statement' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="SelectionDetail" component={SelectionDetailScreen} options={{ title: 'Opexa - Supplier selection' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="FollowUps" component={FollowUpsScreen} options={{ title: 'Opexa - Pending deliveries' }} />}
        {(can(user, PERMS.PURCHASE_MANAGE) || can(user, PERMS.SUPPLIER_INVOICE_VERIFY)) && <Stack.Screen name="SupplierInvoices" component={SupplierInvoicesScreen} options={{ title: 'Opexa - Supplier invoices' }} />}
        {[PERMS.PROJECT_MANAGE, PERMS.PURCHASE_MANAGE, PERMS.SUPPLIER_INVOICE_VERIFY, PERMS.RECEIVING_RECORD, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="Subcontract" component={SubcontractScreen} options={{ title: 'Opexa - Subcontractors' }} />}
        {(can(user, PERMS.INVOICE_EDIT) || can(user, PERMS.SUPPLIER_INVOICE_VERIFY)) && <Stack.Screen name="Tally" component={TallyScreen} options={{ title: 'Opexa - Tally export' }} />}
        {[PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.SUPPLIER_INVOICE_VERIFY, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="Notes" component={NotesScreen} options={{ title: 'Opexa - Credit & debit notes' }} />}
        {[PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="ClientReceipts" component={ClientReceiptsScreen} options={{ title: 'Opexa - Client receipts' }} />}
        {[PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="ClientLedger" component={ClientLedgerScreen} options={{ title: 'Opexa - Client ledger' }} />}
        <Stack.Screen name="MyExpenses" component={MyExpensesScreen} options={{ title: 'Opexa - My expenses' }} />
        <Stack.Screen name="NewExpense" component={ExpenseFormScreen} options={{ title: 'Opexa - New expense' }} />
        <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: 'Opexa - Expense' }} />
        {canPayExpenses(user) && <Stack.Screen name="ExpensesToPay" component={ExpensesToPayScreen} options={{ title: 'Opexa - Expenses to pay' }} />}
        {canSeeExpenseReport(user) && <Stack.Screen name="ExpenseReport" component={ExpenseReportScreen} options={{ title: 'Opexa - Expense report' }} />}
        {can(user, PERMS.SETTINGS_MANAGE) && <Stack.Screen name="ExpenseCategories" component={ExpenseCategoriesScreen} options={{ title: 'Opexa - Expense categories' }} />}
        <Stack.Screen name="ProjectDocuments" component={ProjectDocumentsScreen} options={{ title: 'Opexa - Project documents' }} />
        <Stack.Screen name="ProjectQuantities" component={QuantityViewScreen} options={{ title: 'Opexa - Quantities' }} />
        {[PERMS.PROJECT_MANAGE, PERMS.SERVICE_MANAGE, PERMS.SERVICE_VIEW, PERMS.PROJECT_VIEW, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="HandoverAmc" component={HandoverAmcScreen} options={{ title: 'Opexa - Handover & AMC' }} />}
        {[PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.PROJECT_MANAGE, PERMS.REPORTS_VIEW].some((p) => can(user, p)) && <Stack.Screen name="Commitments" component={CommitmentsScreen} options={{ title: 'Opexa - Retention & guarantees' }} />}
        {[PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.PROJECT_MANAGE, PERMS.RECEIVING_RECORD].some((p) => can(user, p)) && <Stack.Screen name="ProjectBilling" component={ProjectBillingScreen} options={{ title: 'Opexa - Client billing' }} />}
        {(can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW)) && <Stack.Screen name="ProjectFinance" component={ProjectFinanceScreen} options={{ title: 'Opexa - Estimate & profit' }} />}
        {(can(user, PERMS.STORE_MANAGE) || can(user, PERMS.PURCHASE_MANAGE) || can(user, PERMS.PROJECT_MANAGE)) && <Stack.Screen name="Store" component={StoreScreen} options={{ title: 'Opexa - Store' }} />}
        {(can(user, PERMS.PURCHASE_MANAGE) || can(user, PERMS.SUPPLIER_INVOICE_VERIFY)) && <Stack.Screen name="SupplierInvoiceDetail" component={SupplierInvoiceDetailScreen} options={{ title: 'Opexa - Supplier invoice' }} />}
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator initialRouteName={showLanding ? 'Landing' : 'SignIn'} screenOptions={screenOptions}>
      {showLanding && <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Opexa - HVAC project management' }} />}
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Opexa - Sign in' }} />
      {PROTECTED_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} component={RedirectToSignIn} />
      ))}
    </Stack.Navigator>
  );
}

// Which set of screens applies. The navigation container is re-created when this
// changes, so signing in, signing out or setting a password always starts clean.
export function navMode(isSignedIn: boolean, mustChangePassword?: boolean): NavMode {
  if (!isSignedIn) return 'signedOut';
  return mustChangePassword ? 'setPassword' : 'app';
}
