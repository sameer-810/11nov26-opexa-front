import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { notificationApi } from '../../notification/api/notificationApi';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import { receivingApi, type LotToReceive } from '../../receiving/api/receivingApi';
import { materialApi } from '../../material/api/materialApi';
import { attendanceApi } from '../../attendance/api/attendanceApi';
import { hm, type Today } from '../../attendance/types';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { Button } from '../../../shared/ui/Button';
import { colors, maxContentWidth, radius, spacing } from '../../../shared/designSystem';
import { ROLE_LABEL } from '../../team/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

function Tile({ title, body, onPress, testID }: { title: string; body: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" testID={testID}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </Pressable>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const { user, organization, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [openRequests, setOpenRequests] = useState<number | null>(null);
  const [overBoq, setOverBoq] = useState<number | null>(null);
  const buyer = can(user, PERMS.PURCHASE_MANAGE);
  const manager = can(user, PERMS.PROJECT_MANAGE);
  const site = can(user, PERMS.RECEIVING_RECORD);
  const [att, setAtt] = useState<Today | null>(null);
  const [toReceive, setToReceive] = useState<LotToReceive[] | null>(null);
  const [returnsWaiting, setReturnsWaiting] = useState<number | null>(null);

  // Refresh counts each time the dashboard is shown.
  useFocusEffect(
    useCallback(() => {
      notificationApi.list().then((r) => setUnread(r.unread)).catch(() => undefined);
      if (buyer) requisitionApi.list().then((r) => setOpenRequests(r.filter((x) => x.status === 'open').length)).catch(() => undefined);
      if (manager) requisitionApi.list({ overBoq: true }).then((r) => setOverBoq(r.filter((x) => x.status === 'open').length)).catch(() => undefined);
      if (site) receivingApi.toReceive().then(setToReceive).catch(() => undefined);
      if (can(user, PERMS.ATTENDANCE_SELF)) attendanceApi.today().then(setAtt).catch(() => undefined);
      if (manager || buyer) materialApi.returns(undefined, 'pending').then((r) => setReturnsWaiting(r.length)).catch(() => undefined);
    }, [buyer, manager, site]),
  );

  const onSignOut = async () => {
    setBusy(true);
    await signOut();
  };

  return (
    <ScrollView contentContainerStyle={styles.page} testID="dashboard-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.company} testID="dashboard-company">{organization?.name}</Text>
          <Text style={styles.muted} testID="dashboard-user">
            {user?.name} · {user ? ROLE_LABEL[user.role] ?? user.role : ''}
          </Text>
        </View>
        <Button title="Sign out" variant="outline" onPress={onSignOut} loading={busy} testID="signout" />
      </View>
      <Text style={styles.title} accessibilityRole="header" testID="dashboard-welcome">
        Welcome, {user?.name?.split(' ')[0]}
      </Text>
      <View style={styles.grid}>
        <Tile title="Projects" body="Sites, work orders (BOQ) and teams" onPress={() => navigation.navigate('Projects')} testID="tile-projects" />
        <Tile
          title={unread ? `Notifications (${unread})` : 'Notifications'}
          body={unread ? `${unread} unread` : 'You are up to date'}
          onPress={() => navigation.navigate('Notifications')}
          testID="tile-notifications"
        />
        {site ? (
          <Tile
            title={toReceive?.length ? `Deliveries to check in (${toReceive.length})` : 'Deliveries to check in'}
            body={
              toReceive === null ? 'Lots on the way to your sites'
                : toReceive.length === 0 ? 'Nothing on the way right now'
                  : `${toReceive.length} lot${toReceive.length === 1 ? '' : 's'} on the way${toReceive.some((l) => (l.daysInTransit ?? 0) > 2) ? ', some late' : ''}`
            }
            onPress={() => {
              const projects = [...new Set((toReceive ?? []).map((l) => l.projectId))];
              if (projects.length === 1) navigation.navigate('ProjectLots', { id: projects[0] });
              else navigation.navigate('Projects');
            }}
            testID="tile-receive"
          />
        ) : null}
        {can(user, PERMS.ATTENDANCE_SELF) ? (
          <Tile
            title={att?.open ? `Checked in · ${hm(Math.max(0, Math.floor((Date.now() - new Date(att.open.checkIn.at).getTime()) / 60000)))}` : 'Attendance'}
            body={att?.open ? `Since ${att.open.checkIn.time}${att.open.project ? ` at ${att.open.project.name}` : ''}. Tap to check out.` : 'Check in at site with GPS and a selfie'}
            onPress={() => navigation.navigate('Attendance')}
            testID="tile-attendance"
          />
        ) : null}
        {can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT) ? <Tile title="Client invoices" body="Bill delivered lots or installed work" onPress={() => navigation.navigate('Invoices')} testID="tile-invoices" /> : null}
        {can(user, PERMS.SALES_MANAGE) ? <Tile title="Sales" body="Enquiries, quotations, follow-ups" onPress={() => navigation.navigate('Sales')} testID="tile-sales" /> : null}
        {can(user, PERMS.SERVICE_MANAGE) ? <Tile title="Service & warranty" body="Complaints, technician visits, AMC and warranty dates" onPress={() => navigation.navigate('Service')} testID="tile-service" /> : can(user, PERMS.ATTENDANCE_SELF) ? <Tile title="My service jobs" body="Complaints given to you" onPress={() => navigation.navigate('Service')} testID="tile-service" /> : null}
        {can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW) ? <Tile title="Project costing" body="Billed vs material, labour and site costs" onPress={() => navigation.navigate('Costing')} testID="tile-costing" /> : null}
        {can(user, PERMS.PAYROLL_MANAGE) ? <Tile title="Payroll" body="Monthly pay from attendance, advances, Tally" onPress={() => navigation.navigate('Payroll')} testID="tile-payroll" /> : null}
        {can(user, PERMS.ATTENDANCE_SELF) ? <Tile title="My payslips" body="Your monthly pay" onPress={() => navigation.navigate('Payslips')} testID="tile-payslips" /> : null}
        {can(user, PERMS.ATTENDANCE_VIEW) ? <Tile title="Team attendance" body="Who is at which site today" onPress={() => navigation.navigate('TeamAttendance')} testID="tile-team-attendance" /> : null}
        {manager ? <Tile title="Business overview" body="Money, material and what needs attention across all projects" onPress={() => navigation.navigate('Overview')} testID="tile-overview" /> : null}
        {manager || buyer ? (
          <Tile
            title={returnsWaiting ? `Returns to confirm (${returnsWaiting})` : 'Returns to confirm'}
            body="Material sent back from sites"
            onPress={() => navigation.navigate('Returns')}
            testID="tile-returns"
          />
        ) : null}
        {buyer ? (
          <Tile
            title="Material requests"
            body={openRequests === null ? 'Requests from all sites' : `${openRequests} open request${openRequests === 1 ? '' : 's'}`}
            onPress={() => navigation.navigate('Requisitions')}
            testID="tile-requisitions"
          />
        ) : null}
        {buyer ? <Tile title="Purchase orders" body="POs and deliveries (lots)" onPress={() => navigation.navigate('PurchaseOrders')} testID="tile-pos" /> : null}
        {buyer ? <Tile title="Vendors" body="Suppliers you buy from" onPress={() => navigation.navigate('Vendors')} testID="tile-vendors" /> : null}
        {manager ? (
          <Tile
            title="Over BOQ"
            body={overBoq === null ? 'PO amendments needed' : `${overBoq} request${overBoq === 1 ? '' : 's'} beyond the work order`}
            onPress={() => navigation.navigate('Requisitions', { overBoq: 'true' })}
            testID="tile-overboq"
          />
        ) : null}
        {can(user, PERMS.TEAM_MANAGE) ? (
          <Tile title="Team" body="Add people, set roles and access" onPress={() => navigation.navigate('Team')} testID="tile-team" />
        ) : null}
        <Tile title="Change password" body="Update your sign-in password" onPress={() => navigation.navigate('ChangePassword')} testID="tile-password" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  company: { fontSize: 20, fontWeight: '800', color: colors.primary },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 240, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 4, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.surfaceAlt },
  tileTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
});
