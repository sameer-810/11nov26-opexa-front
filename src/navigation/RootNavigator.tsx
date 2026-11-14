import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PROTECTED_ROUTES, type NavMode, type RootStackParamList } from './types';
import { useAuth } from '../shared/store/useAuthStore';
import { can, PERMS } from '../shared/permissions';
import { colors } from '../shared/designSystem';
import { LandingScreen } from '../modules/landing/screens/LandingScreen';
import { SignInScreen } from '../modules/auth/screens/SignInScreen';
import { SignUpScreen } from '../modules/auth/screens/SignUpScreen';
import { DashboardScreen } from '../modules/dashboard/screens/DashboardScreen';
import { TeamScreen } from '../modules/team/screens/TeamScreen';
import { AddMemberScreen } from '../modules/team/screens/AddMemberScreen';
import { MemberDetailScreen } from '../modules/team/screens/MemberDetailScreen';
import { ChangePasswordScreen } from '../modules/profile/screens/ChangePasswordScreen';
import { ProjectsScreen } from '../modules/project/screens/ProjectsScreen';
import { ProjectFormScreen } from '../modules/project/screens/ProjectFormScreen';
import { ProjectDetailScreen } from '../modules/project/screens/ProjectDetailScreen';
import { ProjectTeamScreen } from '../modules/project/screens/ProjectTeamScreen';
import { BoqImportScreen } from '../modules/project/screens/BoqImportScreen';
import { canEditBoq } from '../shared/permissions';
import { RequisitionsScreen } from '../modules/requisition/screens/RequisitionsScreen';
import { NewRequisitionScreen } from '../modules/requisition/screens/NewRequisitionScreen';
import { RequisitionDetailScreen } from '../modules/requisition/screens/RequisitionDetailScreen';
import { NotificationsScreen } from '../modules/notification/screens/NotificationsScreen';
import { VendorsScreen } from '../modules/vendor/screens/VendorsScreen';
import { PurchaseOrdersScreen } from '../modules/purchaseOrder/screens/PurchaseOrdersScreen';
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
import { SalesScreen } from '../modules/sales/screens/SalesScreen';
import { NewLeadScreen } from '../modules/sales/screens/NewLeadScreen';
import { LeadDetailScreen } from '../modules/sales/screens/LeadDetailScreen';
import { QuoteFormScreen } from '../modules/sales/screens/QuoteFormScreen';
import { RedirectToSignIn } from './RedirectToSignIn';

const Stack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = { headerShown: false, contentStyle: { backgroundColor: colors.surface } };

// Signed out: landing (web only) -> sign in / sign up. Any /app/... link redirects to sign in.
// Signed in with a temporary password: only "Set your password".
// Signed in: the app; screens the user has no permission for are not registered at all.
export function RootNavigator({ showLanding = Platform.OS === 'web' }: { showLanding?: boolean }) {
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
      <Stack.Navigator initialRouteName="Dashboard" screenOptions={screenOptions}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Opexa - Dashboard' }} />
        {manageTeam && <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Opexa - Team' }} />}
        {manageTeam && <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Opexa - Add member' }} />}
        {manageTeam && <Stack.Screen name="MemberDetail" component={MemberDetailScreen} options={{ title: 'Opexa - Team member' }} />}
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Opexa - Change password' }} />
        <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Opexa - Projects' }} />
        {manageProjects && <Stack.Screen name="NewProject" component={ProjectFormScreen} options={{ title: 'Opexa - New project' }} />}
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Opexa - Project' }} />
        {manageProjects && <Stack.Screen name="EditProject" component={ProjectFormScreen} options={{ title: 'Opexa - Edit project' }} />}
        {manageProjects && <Stack.Screen name="ProjectTeam" component={ProjectTeamScreen} options={{ title: 'Opexa - Project team' }} />}
        {editBoq && <Stack.Screen name="BoqImport" component={BoqImportScreen} options={{ title: 'Opexa - Import BOQ' }} />}
        <Stack.Screen name="Requisitions" component={RequisitionsScreen} options={{ title: 'Opexa - Material requests' }} />
        {can(user, PERMS.REQUISITION_CREATE) && <Stack.Screen name="NewRequisition" component={NewRequisitionScreen} options={{ title: 'Opexa - New material request' }} />}
        <Stack.Screen name="RequisitionDetail" component={RequisitionDetailScreen} options={{ title: 'Opexa - Material request' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Opexa - Notifications' }} />
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
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="Sales" component={SalesScreen} options={{ title: 'Opexa - Sales' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="NewLead" component={NewLeadScreen} options={{ title: 'Opexa - New enquiry' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Opexa - Enquiry' }} />}
        {can(user, PERMS.SALES_MANAGE) && <Stack.Screen name="QuoteForm" component={QuoteFormScreen} options={{ title: 'Opexa - Quotation' }} />}
        <Stack.Screen name="Payslips" component={MyPayslipsScreen} options={{ title: 'Opexa - My payslips' }} />
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="Payroll" component={PayrollScreen} options={{ title: 'Opexa - Payroll' }} />}
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="PayrollRun" component={PayrollRunScreen} options={{ title: 'Opexa - Payroll' }} />}
        {can(user, PERMS.PAYROLL_MANAGE) && <Stack.Screen name="PayrollPeople" component={PayrollPeopleScreen} options={{ title: 'Opexa - Pay rates' }} />}
        {can(user, PERMS.ATTENDANCE_VIEW) && <Stack.Screen name="TeamAttendance" component={TeamAttendanceScreen} options={{ title: 'Opexa - Team attendance' }} />}
        {can(user, PERMS.PROJECT_MANAGE) && <Stack.Screen name="Overview" component={OverviewScreen} options={{ title: 'Opexa - Business overview' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="Vendors" component={VendorsScreen} options={{ title: 'Opexa - Vendors' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} options={{ title: 'Opexa - Purchase orders' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="NewPurchaseOrder" component={NewPurchaseOrderScreen} options={{ title: 'Opexa - New purchase order' }} />}
        {can(user, PERMS.PURCHASE_MANAGE) && <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} options={{ title: 'Opexa - Purchase order' }} />}
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator initialRouteName={showLanding ? 'Landing' : 'SignIn'} screenOptions={screenOptions}>
      {showLanding && <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Opexa - HVAC project management' }} />}
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Opexa - Sign in' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Opexa - Sign up' }} />
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
