import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notificationApi } from '../../notification/api/notificationApi';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import { receivingApi, type LotToReceive } from '../../receiving/api/receivingApi';
import { materialApi } from '../../material/api/materialApi';
import { attendanceApi } from '../../attendance/api/attendanceApi';
import { hm, type Today } from '../../attendance/types';
import type { RootStackParamList } from '../../../navigation/types';
import { routeForLink } from '../../../navigation/routeForLink';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, canSeeApprovals, PERMS } from '../../../shared/permissions';
import { lit, Backdrop } from '../../../shared/ui/Glass';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { formatShortMoney as short } from '../../../shared/format';
import { glass, maxDashboardWidth, spacing } from '../../../shared/designSystem';
import { ROLE_LABEL } from '../../team/types';
import { overviewApi, type Overview } from '../api/overviewApi';
import { AreaChart, BarList, Donut, Funnel } from '../components/charts';
import { PayChip, Panel, StatCard, Tile } from '../components/widgets';
import { ActivityList, HeroCard, MobileHeader, SectionTitle, type HeroChip } from '../components/mobile';
import type { AppNotification } from '../../notification/api/notificationApi';
import { canSeePayables } from '../../supplierPayment/supplierPaymentApi';
import { RoleDashboard } from '../components/RoleDashboard';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
type Nav = Props['navigation'];
type TileDef = { show: boolean; title: string; body: string; icon: IconName; tint: string; onPress: () => void; testID: string };

const monthLabel = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
const pctChange = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

export function DashboardScreen({ navigation }: Props) {
  const { user, organization, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 1024; // the web shell shows sign-out in the top bar
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<AppNotification[]>([]);
  const [openRequests, setOpenRequests] = useState<number | null>(null);
  const [overBoq, setOverBoq] = useState<number | null>(null);
  const [att, setAtt] = useState<Today | null>(null);
  const [toReceive, setToReceive] = useState<LotToReceive[] | null>(null);
  const [returnsWaiting, setReturnsWaiting] = useState<number | null>(null);
  const [ov, setOv] = useState<Overview | null | undefined>(undefined); // undefined: still loading, null: not available
  const buyer = can(user, PERMS.PURCHASE_MANAGE);
  const manager = can(user, PERMS.PROJECT_MANAGE);
  const site = can(user, PERMS.RECEIVING_RECORD);
  const invoices = can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT);

  // Refresh counts each time the dashboard is shown.
  useFocusEffect(
    useCallback(() => {
      notificationApi.list().then((r) => { setUnread(r.unread); setRecent((r.items ?? []).slice(0, 4)); }).catch(() => undefined);
      if (buyer) requisitionApi.list().then((r) => setOpenRequests(r.filter((x) => x.status === 'open').length)).catch(() => undefined);
      if (manager) requisitionApi.list({ overBoq: true }).then((r) => setOverBoq(r.filter((x) => x.status === 'open').length)).catch(() => undefined);
      if (site) receivingApi.toReceive().then(setToReceive).catch(() => undefined);
      if (can(user, PERMS.ATTENDANCE_SELF)) attendanceApi.today().then(setAtt).catch(() => undefined);
      if (manager || buyer || can(user, PERMS.STORE_MANAGE)) materialApi.returns(undefined, 'pending').then((r) => setReturnsWaiting(r.length)).catch(() => undefined);
      if (manager) overviewApi.get().then((o) => setOv(o?.billing && o.totals ? o : null)).catch(() => setOv(null));
    }, [buyer, manager, site]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openLink = (link: string | null) => {
    const t = routeForLink(link, user);
    if (t) (navigation.navigate as (n: string, p?: object) => void)(t.name, t.params);
    else navigation.navigate('Notifications');
  };
  const userLine = `${user?.name ?? ''} · ${user ? ROLE_LABEL[user.role] ?? user.role : ''}`;

  const tiles = quickTiles(navigation, user, { unread, openRequests, overBoq, att, toReceive, returnsWaiting, buyer, manager, site, invoices });

  return (
    <View style={styles.root}>
      {wide ? null : <Backdrop />}
      <ScrollView contentContainerStyle={styles.page} testID="dashboard-screen">
{wide ? (
          <>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.hello} testID="dashboard-welcome">Welcome, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.title} accessibilityRole="header" testID="dashboard-company">{organization?.name}</Text>
            <Text style={styles.subtitle} testID="dashboard-user">
              {user?.name} · {user ? ROLE_LABEL[user.role] ?? user.role : ''}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          {ov ? (
            <>
              <StatCard icon="folder" tint={glass.indigo} label="Active projects" value={String(ov.projects.active)} sub={`${ov.projects.closing} closing · ${ov.projects.closed} closed`} onPress={() => navigation.navigate('Projects')} testID="stat-projects" />
              <StatCard icon="layers" tint={glass.sky} label="BOQ value (open jobs)" value={short(ov.totals.boqValue)} sub={`${short(ov.totals.installedValue)} installed`} testID="stat-boq" />
              <StatCard icon="receipt" tint={glass.violet} label="Billed this month" value={short(ov.billing.months[5]?.billed ?? 0)} delta={pctChange(ov.billing.months[5]?.billed ?? 0, ov.billing.months[4]?.billed ?? 0)} sub="vs. previous month" onPress={invoices ? () => navigation.navigate('Invoices') : undefined} testID="stat-billed" />
              <StatCard icon="wallet" tint={glass.pink} label="Outstanding from clients" value={short(ov.billing.outstanding)} sub="Issued invoices not yet received" testID="stat-outstanding" />
            </>
          ) : manager && ov === undefined ? null : (
            <>
              <StatCard icon="bell" tint={glass.indigo} label="Unread notifications" value={String(unread)} onPress={() => navigation.navigate('Notifications')} testID="stat-unread" />
              {site ? <StatCard icon="truck" tint={glass.sky} label="Deliveries on the way" value={String(toReceive?.length ?? '—')} testID="stat-receive" /> : null}
              {buyer ? <StatCard icon="clipboard" tint={glass.violet} label="Open material requests" value={String(openRequests ?? '—')} testID="stat-requests" /> : null}
              {returnsWaiting !== null ? <StatCard icon="undo" tint={glass.pink} label="Returns to confirm" value={String(returnsWaiting)} testID="stat-returns" /> : null}
            </>
          )}
        </View>

          </>
        ) : (
          <>
        <MobileHeader name={user?.name} welcome={`Welcome, ${user?.name?.split(' ')[0] ?? ''}`} company={organization?.name} userLine={userLine}
          unread={unread} onBell={() => navigation.navigate('Notifications')} onSignOut={() => void signOut()} />
        {ov ? (
          <HeroCard
            label="Outstanding from clients"
            value={short(ov.billing.outstanding)}
            sub="Issued invoices not yet received"
            trend={ov.billing.months.map((m) => m.billed)}
            chips={[
              { label: 'This month', value: short(ov.billing.months[5]?.billed ?? 0), tone: (pctChange(ov.billing.months[5]?.billed ?? 0, ov.billing.months[4]?.billed ?? 0) ?? 0) >= 0 ? 'up' : 'down' },
              { label: 'Projects', value: String(ov.projects.active) },
              { label: 'BOQ', value: short(ov.totals.boqValue) },
            ]}
            testID="hero-card"
          />
        ) : (
          <HeroCard
            label="Unread alerts"
            value={String(unread)}
            sub={organization?.name}
            chips={([
              site ? { label: 'On the way', value: String(toReceive?.length ?? '—') } : null,
              buyer ? { label: 'Requests', value: String(openRequests ?? '—') } : null,
              returnsWaiting !== null ? { label: 'Returns', value: String(returnsWaiting) } : null,
              can(user, PERMS.ATTENDANCE_SELF) ? { label: 'Attendance', value: att?.open ? 'Checked in' : 'Not in' } : null,
            ].filter(Boolean) as HeroChip[]).slice(0, 3)}
            testID="hero-card"
          />
        )}
        <SectionTitle action="See all" onAction={() => navigation.navigate('Notifications')}>Recent activity</SectionTitle>
        <ActivityList items={recent} onOpen={(n) => openLink(n.link)} testID="activity-list" />
          </>
        )}

        {ov ? <ManagerPanels ov={ov} navigation={navigation} invoices={invoices} user={user} /> : null}

        <RoleDashboard onDrill={(t) => { if (navigation.getState()?.routeNames.includes(t.screen as keyof RootStackParamList)) (navigation.navigate as (n: string, p?: object) => void)(t.screen, t.params); }} />

        <Text style={styles.h2} accessibilityRole="header">Quick access</Text>
        <View style={styles.row}>
          {tiles.filter((t) => t.show).map((t) => <Tile key={t.testID} compact={!wide} {...t} />)}
        </View>
      </ScrollView>
    </View>
  );
}

function ManagerPanels({ ov, navigation, invoices, user }: { ov: Overview; navigation: Nav; invoices: boolean; user: ReturnType<typeof useAuth>['user'] }) {
  const cur = ov.billing.months[5]?.billed ?? 0;
  const delta = pctChange(cur, ov.billing.months[4]?.billed ?? 0);
  const topProjects = [...ov.projectRows].sort((a, b) => b.boqValue - a.boqValue).slice(0, 5);
  const open = (link: string) => {
    const t = routeForLink(link, user);
    if (t) (navigation.navigate as (n: string, p?: object) => void)(t.name, t.params);
  };
  return (
    <>
      <View style={styles.row}>
        <Panel icon="chart" title="Billing overview" action={invoices ? 'Invoices' : undefined} onAction={() => navigation.navigate('Invoices')} style={{ flexGrow: 1.5 }} testID="panel-billing">
          <View>
            <View style={styles.bigRow}>
              <Text style={styles.big}>{short(cur)}</Text>
              {delta !== null ? (
                <View style={styles.deltaRow}>
                  <Icon name={delta >= 0 ? 'arrowUp' : 'arrowDown'} size={14} color={delta >= 0 ? glass.green : glass.pink} strokeWidth={2.4} />
                  <Text style={{ color: delta >= 0 ? glass.green : glass.pink, fontWeight: '700' }}>{Math.abs(delta)}%</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.muted}>Billed this month · last 6 months below</Text>
          </View>
          <AreaChart points={ov.billing.months.map((m) => ({ label: monthLabel(m.month), value: m.billed }))} format={short} testID="chart-billing" />
        </Panel>
        <Panel icon="pie" title="Projects overview" action="Projects" onAction={() => navigation.navigate('Projects')} testID="panel-projects">
          <Donut
            centerLabel="Projects"
            slices={[
              { label: 'Active', value: ov.projects.active, color: glass.indigo },
              { label: 'Closing', value: ov.projects.closing, color: glass.sky },
              { label: 'Closed', value: ov.projects.closed, color: glass.violet },
            ]}
            testID="chart-projects"
          />
        </Panel>
      </View>

      <View style={styles.row}>
        <Panel icon="truck" title="Material pipeline" action="Details" onAction={() => navigation.navigate('Overview')} testID="panel-pipeline">
          <BarList
            rows={[
              { label: 'Waiting for PO', value: ov.material.requestsAwaitingPo, icon: 'clipboard', color: glass.indigo },
              { label: 'Over BOQ', value: ov.material.requestsOverBoq, icon: 'alert', color: glass.amber },
              { label: 'On the way', value: ov.material.lotsInTransit, icon: 'truck', color: glass.sky },
              { label: 'Late (2+ days)', value: ov.material.lotsLate, icon: 'clock', color: glass.pink },
              { label: 'Returns to confirm', value: ov.material.returnsPending, icon: 'undo', color: glass.violet },
            ]}
          />
          {ov.material.stockShortValue30d > 0 ? <Text style={styles.warn}>Stock short in the last 30 days: {short(ov.material.stockShortValue30d)}</Text> : null}
        </Panel>
        <Panel icon="funnel" title="Material progress" testID="panel-funnel">
          <Funnel
            format={short}
            stages={[
              { label: 'BOQ value', value: ov.totals.boqValue, colors: ['#6366F1', '#5B5BEF'] },
              { label: 'Supplied to site', value: ov.totals.suppliedValue, colors: ['#60A5FA', '#38BDF8'] },
              { label: 'Installed', value: ov.totals.installedValue, colors: ['#A78BFA', '#EC4899'] },
            ]}
          />
        </Panel>
      </View>

      <View style={styles.row}>
        <Panel icon="folder" title="Largest projects" action="View all" onAction={() => navigation.navigate('Overview')} testID="panel-top-projects">
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { width: 28 }]}>#</Text>
            <Text style={[styles.th, styles.flex]}>Project</Text>
            <Text style={[styles.th, { width: 110 }]}>Installed</Text>
            <Text style={[styles.th, styles.num, { width: 90 }]}>BOQ</Text>
          </View>
          {topProjects.length === 0 ? <Text style={styles.muted}>No open projects yet.</Text> : null}
          {topProjects.map((p, i) => (
            <Pressable key={p.id} style={(s) => [styles.tr, lit(s) && styles.hover]} onPress={() => navigation.navigate('ProjectDetail', { id: p.id })} testID={`dash-project-${p.code}`}>
              <Text style={[styles.td, { width: 28 }]}>{i + 1}</Text>
              <View style={styles.flex}>
                <Text style={styles.td} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.small} numberOfLines={1}>{p.code} · {p.clientName}</Text>
              </View>
              <View style={{ width: 110, gap: 4 }}>
                <Text style={styles.small}>{p.installedPct}%</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, p.installedPct)}%` }]} /></View>
              </View>
              <Text style={[styles.td, styles.num, { width: 90 }]}>{short(p.boqValue)}</Text>
            </Pressable>
          ))}
        </Panel>
        <Panel icon="file" title="Recent invoices" action={invoices ? 'View all' : undefined} onAction={() => navigation.navigate('Invoices')} testID="panel-invoices">
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { width: 96 }]}>Invoice</Text>
            <Text style={[styles.th, styles.flex]}>Client / project</Text>
            <Text style={[styles.th, styles.num, { width: 90 }]}>Amount</Text>
            <Text style={[styles.th, { width: 88, paddingLeft: 12 }]}>Status</Text>
          </View>
          {ov.billing.recent.length === 0 ? <Text style={styles.muted}>No invoices issued yet.</Text> : null}
          {ov.billing.recent.map((r) => (
            <Pressable key={r.id} disabled={!invoices} style={(s) => [styles.tr, lit(s) && styles.hover]} onPress={() => navigation.navigate('InvoiceDetail', { id: r.id })} testID={`dash-invoice-${r.number}`}>
              <Text style={[styles.td, { width: 96 }]} numberOfLines={1}>{r.number}</Text>
              <View style={styles.flex}>
                <Text style={styles.td} numberOfLines={1}>{r.client}</Text>
                <Text style={styles.small} numberOfLines={1}>{r.project}</Text>
              </View>
              <Text style={[styles.td, styles.num, { width: 90 }]}>{short(r.total)}</Text>
              <View style={{ width: 88, paddingLeft: 12 }}><PayChip status={r.status} /></View>
            </Pressable>
          ))}
        </Panel>
      </View>

      {ov.attention.length ? (
        <Panel icon="alert" title="Needs your attention" action="Overview" onAction={() => navigation.navigate('Overview')} testID="panel-attention">
          {ov.attention.slice(0, 6).map((a, i) => (
            <Pressable key={i} onPress={() => open(a.link)} style={(s) => [styles.alert, lit(s) && styles.hover]} testID={`dash-attention-${i}`}>
              <Icon name="alert" size={16} color={glass.amber} />
              <Text style={[styles.td, styles.flex]}>{a.title}</Text>
              <Icon name="chevronRight" size={16} color={glass.inkMuted} />
            </Pressable>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

// Every module the user may open, as quick-access tiles (test IDs are used by the app tests).
function quickTiles(navigation: Nav, user: ReturnType<typeof useAuth>['user'], s: {
  unread: number; openRequests: number | null; overBoq: number | null; att: Today | null; toReceive: LotToReceive[] | null; returnsWaiting: number | null;
  buyer: boolean; manager: boolean; site: boolean; invoices: boolean;
}): TileDef[] {
  const { buyer, manager, site, toReceive, att } = s;
  const go = (name: keyof RootStackParamList) => () => (navigation.navigate as (n: string) => void)(name);
  return [
    { show: true, title: 'Projects', body: 'Sites, work orders (BOQ) and teams', icon: 'folder', tint: glass.indigo, onPress: go('Projects'), testID: 'tile-projects' },
    { show: true, title: s.unread ? `Notifications (${s.unread})` : 'Notifications', body: s.unread ? `${s.unread} unread` : 'You are up to date', icon: 'bell', tint: glass.violet, onPress: go('Notifications'), testID: 'tile-notifications' },
    { show: canSeeApprovals(user), title: 'My approvals', body: 'Requests waiting for your decision', icon: 'check', tint: glass.green, onPress: go('Approvals'), testID: 'tile-approvals' },
    {
      show: site,
      title: toReceive?.length ? `Deliveries to check in (${toReceive.length})` : 'Deliveries to check in',
      body: toReceive === null ? 'Lots on the way to your sites'
        : toReceive.length === 0 ? 'Nothing on the way right now'
          : `${toReceive.length} lot${toReceive.length === 1 ? '' : 's'} on the way${toReceive.some((l) => (l.daysInTransit ?? 0) > 2) ? ', some late' : ''}`,
      icon: 'truck', tint: glass.sky,
      onPress: () => {
        const projects = [...new Set((toReceive ?? []).map((l) => l.projectId))];
        if (projects.length === 1) navigation.navigate('ProjectLots', { id: projects[0] });
        else navigation.navigate('Projects');
      },
      testID: 'tile-receive',
    },
    {
      show: can(user, PERMS.ATTENDANCE_SELF),
      title: att?.open ? `Checked in · ${hm(Math.max(0, Math.floor((Date.now() - new Date(att.open.checkIn.at).getTime()) / 60000)))}` : 'Attendance',
      body: att?.open ? `Since ${att.open.checkIn.time}${att.open.project ? ` at ${att.open.project.name}` : ''}. Tap to check out.` : 'Check in at site with GPS and a selfie',
      icon: 'clock', tint: glass.green, onPress: go('Attendance'), testID: 'tile-attendance',
    },
    { show: s.invoices, title: 'Client invoices', body: 'Bill delivered lots or installed work', icon: 'receipt', tint: glass.violet, onPress: go('Invoices'), testID: 'tile-invoices' },
    { show: can(user, PERMS.SALES_MANAGE), title: 'Sales', body: 'Enquiries, quotations, follow-ups', icon: 'trend', tint: glass.pink, onPress: go('Sales'), testID: 'tile-sales' },
    can(user, PERMS.SERVICE_MANAGE)
      ? { show: true, title: 'Service & warranty', body: 'Complaints, technician visits, AMC and warranty dates', icon: 'tool', tint: glass.sky, onPress: go('Service'), testID: 'tile-service' }
      : { show: can(user, PERMS.ATTENDANCE_SELF), title: 'My service jobs', body: 'Complaints given to you', icon: 'tool', tint: glass.sky, onPress: go('Service'), testID: 'tile-service' },
    { show: manager || can(user, PERMS.REPORTS_VIEW), title: 'Project costing', body: 'Billed vs material, labour and site costs', icon: 'pie', tint: glass.indigo, onPress: go('Costing'), testID: 'tile-costing' },
    { show: can(user, PERMS.PAYROLL_MANAGE), title: 'Payroll', body: 'Monthly pay from attendance, advances, Tally', icon: 'wallet', tint: glass.green, onPress: go('Payroll'), testID: 'tile-payroll' },
    { show: true, title: 'My expenses', body: 'Claim expenses with the receipt; see approval and payment', icon: 'wallet', tint: glass.amber, onPress: go('MyExpenses'), testID: 'tile-expenses' },
    { show: can(user, PERMS.ATTENDANCE_SELF), title: 'My payslips', body: 'Your monthly pay', icon: 'rupee', tint: glass.violet, onPress: go('Payslips'), testID: 'tile-payslips' },
    { show: can(user, PERMS.ATTENDANCE_VIEW), title: 'Team attendance', body: 'Who is at which site today', icon: 'users', tint: glass.sky, onPress: go('TeamAttendance'), testID: 'tile-team-attendance' },
    { show: manager, title: 'Business overview', body: 'Money, material and what needs attention across all projects', icon: 'chart', tint: glass.indigo, onPress: go('Overview'), testID: 'tile-overview' },
    // Store staff confirm store returns into their warehouse (1E).
    { show: manager || buyer || can(user, PERMS.STORE_MANAGE), title: s.returnsWaiting ? `Returns to confirm (${s.returnsWaiting})` : 'Returns to confirm', body: 'Material sent back from sites', icon: 'undo', tint: glass.pink, onPress: go('Returns'), testID: 'tile-returns' },
    { show: buyer, title: 'Material requests', body: s.openRequests === null ? 'Requests from all sites' : `${s.openRequests} open request${s.openRequests === 1 ? '' : 's'}`, icon: 'clipboard', tint: glass.indigo, onPress: go('Requisitions'), testID: 'tile-requisitions' },
    { show: can(user, PERMS.INVOICE_EDIT) || can(user, PERMS.SUPPLIER_INVOICE_VERIFY), title: 'Tally export', body: 'Vouchers, credit / debit notes, masters and reversals', icon: 'upload', tint: glass.green, onPress: go('Tally'), testID: 'tile-tally' },
    { show: [PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.REPORTS_VIEW].some((p) => can(user, p)), title: 'Receivables', body: 'Client receipts, credit / debit notes, client ledger', icon: 'rupee', tint: glass.green, onPress: go('ClientReceipts'), testID: 'tile-receivables' },
    { show: [PERMS.INVOICE_CREATE, PERMS.INVOICE_EDIT, PERMS.PROJECT_MANAGE, PERMS.REPORTS_VIEW].some((p) => can(user, p)), title: 'Retention & guarantees', body: 'Retention to claim, bank guarantee expiries', icon: 'shield', tint: glass.violet, onPress: go('Commitments'), testID: 'tile-commitments' },
    { show: manager || site || can(user, PERMS.SUPPLIER_INVOICE_VERIFY), title: 'Subcontractors', body: 'Work orders, verified progress, payment certificates', icon: 'hardhat', tint: glass.amber, onPress: go('Subcontract'), testID: 'tile-subcontract' },
    { show: can(user, PERMS.STORE_MANAGE) || buyer || manager, title: 'Store', body: 'Stock by warehouse and site, transfers, issues, tools', icon: 'box', tint: glass.sky, onPress: go('Store'), testID: 'tile-store' },
    { show: buyer, title: 'Procurement', body: 'RFQs, quotations, supplier selection, deliveries and supplier invoices', icon: 'cart', tint: glass.indigo, onPress: go('Procurement'), testID: 'tile-procurement' },
    { show: !buyer && can(user, PERMS.SUPPLIER_INVOICE_VERIFY), title: 'Supplier invoices', body: 'Verify invoices against POs and goods receipts', icon: 'file', tint: glass.violet, onPress: go('SupplierInvoices'), testID: 'tile-supplier-invoices' },
    { show: buyer, title: 'Purchase orders', body: 'POs and deliveries (lots)', icon: 'file', tint: glass.sky, onPress: go('PurchaseOrders'), testID: 'tile-pos' },
    { show: buyer, title: 'Vendors', body: 'Suppliers you buy from', icon: 'store', tint: glass.green, onPress: go('Vendors'), testID: 'tile-vendors' },
    { show: canSeePayables(user), title: 'Supplier payables', body: 'What we owe suppliers, ageing, payments and ledgers', icon: 'rupee', tint: glass.amber, onPress: go('Payables'), testID: 'tile-payables' },
    {
      show: manager, title: 'Over BOQ', body: s.overBoq === null ? 'PO amendments needed' : `${s.overBoq} request${s.overBoq === 1 ? '' : 's'} beyond the work order`,
      icon: 'alert', tint: glass.amber, onPress: () => navigation.navigate('Requisitions', { overBoq: 'true' }), testID: 'tile-overboq',
    },
    { show: can(user, PERMS.TEAM_MANAGE) || can(user, PERMS.TEAM_VIEW), title: 'Team', body: 'Add people, set roles and access', icon: 'users', tint: glass.indigo, onPress: go('Team'), testID: 'tile-team' },
    { show: true, title: 'Change password', body: 'Update your sign-in password', icon: 'lock', tint: glass.inkMuted, onPress: go('ChangePassword'), testID: 'tile-password' },
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  page: { width: '100%', maxWidth: maxDashboardWidth, alignSelf: 'center', padding: spacing.lg, gap: 20, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  hello: { fontSize: 15, color: glass.inkMuted },
  title: { fontSize: 32, fontWeight: '800', color: glass.ink, marginTop: 2 },
  subtitle: { fontSize: 15, color: glass.inkMuted, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  h2: { fontSize: 18, fontWeight: '700', color: glass.ink, marginTop: 4 },
  bigRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  big: { fontSize: 30, fontWeight: '800', color: glass.ink },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.10)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  muted: { fontSize: 13, color: glass.inkMuted },
  small: { fontSize: 12, color: glass.inkMuted },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: glass.line, borderRadius: 8 },
  thead: { paddingVertical: 6 },
  th: { fontSize: 12, fontWeight: '600', color: glass.inkMuted },
  td: { fontSize: 14, color: glass.ink },
  num: { textAlign: 'right' },
  hover: { backgroundColor: 'rgba(255,255,255,0.6)' },
  track: { height: 6, borderRadius: 3, backgroundColor: glass.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: glass.indigo },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
});
