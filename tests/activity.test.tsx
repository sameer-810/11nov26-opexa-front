import { act, fireEvent, screen } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import type { RouteTarget } from '../src/navigation/routeForLink';
import { installMockApi } from './helpers/mockApi';
import { installActivityMock } from './helpers/mockActivityApi';
import { renderApp } from './helpers/renderApp';
import { NAV_ITEMS } from '../src/navigation/navItems';
import type { ActivityEntry } from '../src/modules/activity/activityApi';
import type { User } from '../src/modules/auth/types';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

const entry = (i: number, over: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: `a${i}`, entityType: 'boq_item', entityId: `i${i}`, entityNumber: `S.No ${i}`, action: 'updated', projectId: 'p1', project: { code: 'P-001', name: 'Worli Tower' },
  workOrderItemId: `i${i}`, user: { id: 'u1', name: 'Ehtesham', role: 'owner' }, at: '2026-11-20T06:30:00.000Z',
  changes: [{ field: 'quantity', old: 10, new: 12 }], approvalStatus: null, approverId: null, remarks: null, documentIds: [], ...over,
});

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.addUser({ email: 'audit@airtech.in', password: 'Audit12345', role: 'engineer', name: 'Asha Admin', permissions: ['audit.view', 'team.manage'] });
  api.addUser({ email: 'meena@airtech.in', password: 'Meena12345', role: 'accounts', name: 'Meena' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli Tower', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  return { api, mock: installActivityMock(api) };
}

async function openAs(email: string, password: string, go: RouteTarget) {
  const ref = await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
  await act(async () => { ref.dispatch(CommonActions.navigate(go)); });
}

describe('1A.6 / X2 - Activity', () => {
  test('a project member reads the project timeline: who, role, when, old -> new; filters and pages', async () => {
    const { mock } = setup();
    mock.activity.push(entry(0, { entityType: 'invoice', entityNumber: 'GAT/26-27/0001', action: 'revised', user: { id: 'u4', name: 'Meena', role: 'accounts' }, changes: [{ field: 'lines', old: 'S.No 2: 2 × 51000', new: 'S.No 2: 3 × 51000' }], remarks: 'Client certified 3 units' }));
    for (let i = 1; i <= 34; i += 1) mock.activity.push(entry(i));
    await openAs('ravi@airtech.in', 'Ravi12345', { name: 'ProjectActivity', params: { id: 'p1' } });

    expect(await screen.findByTestId('activity-count')).toHaveTextContent('Showing 30 of 35');
    expect(screen.getByTestId('activity-a0')).toHaveTextContent(/Invoice GAT\/26-27\/0001/);
    expect(screen.getByTestId('activity-a0')).toHaveTextContent(/Meena \(accounts\)/);
    expect(screen.getByTestId('activity-a0-change-0')).toHaveTextContent('lines: S.No 2: 2 × 51000 → S.No 2: 3 × 51000');
    expect(screen.getByTestId('activity-a0')).toHaveTextContent(/Client certified 3 units/);
    expect(mock.activityQueries[0]).toContain('projectId=p1');

    await fireEvent.press(screen.getByTestId('activity-more'));
    expect(await screen.findByText('Showing 35 of 35')).toBeTruthy();
    expect(screen.queryByTestId('activity-more')).toBeNull();

    await fireEvent.press(screen.getByTestId('pa-type-invoice'));
    expect(await screen.findByText('Showing 1 of 1')).toBeTruthy();
    expect(mock.activityQueries.at(-1)).toContain('entityType=invoice');
    expect(screen.getByTestId('activity-a0-change-0')).toBeTruthy();
  });

  test('project detail links to the activity; an empty project says so', async () => {
    setup();
    await openAs('ravi@airtech.in', 'Ravi12345', { name: 'ProjectDetail', params: { id: 'p1' } });
    await fireEvent.press(await screen.findByTestId('project-activity'));
    expect(await screen.findByTestId('project-activity-screen')).toBeTruthy();
    expect(await screen.findByText('No activity found')).toBeTruthy();
  });

  test('the company activity log: only with audit.view; filters by record, project and person', async () => {
    const { mock } = setup();
    mock.activity.push(entry(1), entry(2, { entityType: 'user', entityNumber: 'ravi@airtech.in', action: 'access_changed', projectId: null, project: null, changes: [{ field: 'role', old: 'engineer', new: 'supervisor' }] }));
    const show = NAV_ITEMS.find((i) => i.route === 'ActivityLog')!.show;
    expect(show({ permissions: ['audit.view'] } as unknown as User)).toBe(true);
    expect(show({ permissions: ['project.manage'] } as unknown as User)).toBe(false);

    await openAs('audit@airtech.in', 'Audit12345', { name: 'ActivityLog', params: undefined });
    expect(await screen.findByTestId('activity-log-screen')).toBeTruthy();
    expect(await screen.findByTestId('activity-a2-change-0')).toHaveTextContent('role: engineer → supervisor');
    expect(screen.getByTestId('activity-a1')).toHaveTextContent(/P-001/);
    expect(mock.activityQueries[0]).toMatch(/from=\d{4}-\d{2}-01/);

    await fireEvent.press(screen.getByTestId('al-type-user'));
    await fireEvent.press(screen.getByTestId('al-show'));
    expect(await screen.findByText('Showing 1 of 1')).toBeTruthy();
    expect(screen.queryByTestId('activity-a1')).toBeNull();
    expect(mock.activityQueries.at(-1)).toContain('entityType=user');
  });
});

describe('1H - Attendance report', () => {
  test('shows totals, per-person numbers and the muster; filters reload', async () => {
    const { mock } = setup();
    mock.setReport({
      from: '2026-11-01', to: '2026-11-03', lateAfter: '09:30', dates: ['2026-11-01', '2026-11-02', '2026-11-03'],
      rows: [{ user: { id: 'u2', name: 'Ravi Kumar', role: 'engineer', department: 'Installation' }, daysPresent: 2, daysAbsent: 1, lateDays: 1, totalMinutes: 960, hours: 16, outsideAttempts: 1, checkoutOutside: 0, corrections: 1, missedCheckouts: 0 }],
      muster: [{ userId: 'u2', name: 'Ravi Kumar', cells: [{ date: '2026-11-01', code: 'P', minutes: 540 }, { date: '2026-11-02', code: 'L', minutes: 420 }, { date: '2026-11-03', code: 'A', minutes: 0 }] }],
      totals: { people: 1, daysPresent: 2, lateDays: 1, hours: 16, outsideAttempts: 1, corrections: 1 },
    });
    await openAs('meena@airtech.in', 'Meena12345', { name: 'TeamAttendance', params: undefined });
    await fireEvent.press(await screen.findByTestId('open-attendance-report'));
    expect(await screen.findByTestId('ar-totals')).toHaveTextContent('1 people · 2 days present · 1 late · 16 h · 1 refused outside the area · 1 corrected');
    expect(screen.getByTestId('ar-row-u2')).toHaveTextContent(/Installation/);
    expect(screen.getByTestId('ar-row-u2')).toHaveTextContent(/Present 2 · Absent 1 · Late 1 · 16h 00m · Outside-area check-ins 1/);
    expect(screen.getByTestId('ar-muster-u2')).toHaveTextContent('Ravi KumarPLA');

    await fireEvent.changeText(screen.getByTestId('ar-from'), '2026-11-01');
    await fireEvent.changeText(screen.getByTestId('ar-late'), '10:00');
    await fireEvent.press(screen.getByTestId('ar-show'));
    await screen.findByTestId('ar-totals');
    expect(mock.reportQueries.at(-1)).toContain('from=2026-11-01');
    expect(mock.reportQueries.at(-1)).toContain('lateAfter=10%3A00');
  });
});
