import { act, fireEvent, screen } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import type { RouteTarget } from '../src/navigation/routeForLink';
import { installMockApi } from './helpers/mockApi';
import { installActivityMock } from './helpers/mockActivityApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli Tower', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  return { api, eng, mock: installActivityMock(api) };
}

async function openAs(email: string, password: string, go: RouteTarget) {
  const ref = await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
  await act(async () => { ref.dispatch(CommonActions.navigate(go)); });
}

describe('1A.3 - Schedule milestones', () => {
  test('a manager adds a milestone, sees it delayed, marks it done; progress follows', async () => {
    const { eng, mock } = setup();
    await openAs('owner@airtech.in', 'Owner12345', { name: 'ProjectMilestones', params: { id: 'p1' } });
    expect(await screen.findByText('No milestones yet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ms-add'));
    await fireEvent.press(screen.getByTestId('ms-save'));
    expect(screen.getByTestId('ms-name-error')).toHaveTextContent('Enter a name');
    expect(screen.getByTestId('ms-planned-error')).toHaveTextContent('Use YYYY-MM-DD');
    expect(mock.milestones).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('ms-name'), 'Ducting complete');
    await fireEvent.changeText(screen.getByTestId('ms-planned'), '2026-11-20');
    await fireEvent.press(await screen.findByTestId(`ms-owner-${eng.id}`));
    await fireEvent.press(screen.getByTestId('ms-save'));
    expect(await screen.findByTestId('ms-status-m1')).toHaveTextContent('Delayed');
    expect(screen.getByTestId('ms-progress')).toHaveTextContent('0 of 1 done · 0% · 1 delayed');
    expect(mock.milestones[0]).toMatchObject({ name: 'Ducting complete', plannedDate: '2026-11-20', ownerId: eng.id, ownerName: 'Ravi Kumar' });
    expect(screen.getByTestId('ms-row-m1')).toHaveTextContent(/Ravi Kumar/);

    await fireEvent.press(screen.getByTestId('ms-add'));
    await fireEvent.changeText(screen.getByTestId('ms-name'), 'Testing & commissioning');
    await fireEvent.changeText(screen.getByTestId('ms-planned'), '2026-12-15');
    await fireEvent.press(screen.getByTestId('ms-started-yes'));
    await fireEvent.press(screen.getByTestId('ms-save'));
    expect(await screen.findByTestId('ms-status-m2')).toHaveTextContent('In progress');

    await fireEvent.press(screen.getByTestId('ms-row-m1'));
    await fireEvent.changeText(screen.getByTestId('ms-actual'), '22-11-2026');
    await fireEvent.press(screen.getByTestId('ms-save'));
    expect(screen.getByTestId('ms-actual-error')).toHaveTextContent('Use YYYY-MM-DD, or leave empty');
    await fireEvent.changeText(screen.getByTestId('ms-actual'), '2026-11-22');
    await fireEvent.press(screen.getByTestId('ms-save'));
    expect(await screen.findByText('1 of 2 done · 50%')).toBeTruthy();
    expect(screen.getByTestId('ms-status-m1')).toHaveTextContent('Done');

    await fireEvent.press(screen.getByTestId('ms-row-m2'));
    await fireEvent.press(screen.getByTestId('ms-remove'));
    expect(await screen.findByText('1 of 1 done · 100%')).toBeTruthy();
    expect(screen.queryByTestId('ms-row-m2')).toBeNull();
  });

  test('a project member who does not manage projects only reads the schedule', async () => {
    const { mock } = setup();
    mock.milestones.push({ id: 'm9', projectId: 'p1', name: 'Supply of AHUs', plannedDate: '2026-12-01', actualDate: null, startedAt: null, status: 'planned', ownerId: null, ownerName: null, remarks: 'Awaiting vendor dispatch' });
    await openAs('ravi@airtech.in', 'Ravi12345', { name: 'ProjectMilestones', params: { id: 'p1' } });
    expect(await screen.findByTestId('ms-row-m9')).toHaveTextContent(/Awaiting vendor dispatch/);
    expect(screen.getByTestId('ms-status-m9')).toHaveTextContent('Planned');
    expect(screen.queryByTestId('ms-add')).toBeNull();
    await fireEvent.press(screen.getByTestId('ms-row-m9'));
    expect(screen.queryByTestId('ms-form')).toBeNull();
  });

  test('project detail shows the project manager and schedule progress, with links to schedule and activity', async () => {
    const { api, mock } = setup();
    const pm = api.addUser({ email: 'pm@airtech.in', password: 'Pm1234567', role: 'engineer', name: 'Sameer PM', permissions: ['project.manage', 'attendance.self'] });
    mock.setManager('p1', pm.id);
    mock.milestones.push({ id: 'm1', projectId: 'p1', name: 'Ducting', plannedDate: '2026-11-01', actualDate: '2026-11-02', startedAt: null, status: 'done', ownerId: null, ownerName: null, remarks: null });
    mock.milestones.push({ id: 'm2', projectId: 'p1', name: 'Piping', plannedDate: '2026-11-10', actualDate: null, startedAt: null, status: 'planned', ownerId: null, ownerName: null, remarks: null });
    await openAs('pm@airtech.in', 'Pm1234567', { name: 'ProjectDetail', params: { id: 'p1' } });
    expect(await screen.findByTestId('fact-pm')).toHaveTextContent('Sameer PM');
    expect(screen.getByTestId('fact-schedule')).toHaveTextContent('50% (1 of 2 milestones), 1 delayed');
    await fireEvent.press(screen.getByTestId('project-milestones'));
    expect(await screen.findByTestId('milestones-screen')).toBeTruthy();
    // The project's own manager may edit.
    expect(screen.getByTestId('ms-add')).toBeTruthy();
  });

  test('the project form offers people who can manage projects as project manager', async () => {
    const { api } = setup();
    const pm = api.addUser({ email: 'pm@airtech.in', password: 'Pm1234567', role: 'engineer', name: 'Sameer PM', permissions: ['project.manage'] });
    await openAs('owner@airtech.in', 'Owner12345', { name: 'EditProject', params: { id: 'p1' } });
    expect(await screen.findByTestId(`pf-pm-${pm.id}`)).toBeTruthy();
    expect(screen.queryByText('Ravi Kumar')).toBeNull(); // engineer without project.manage
    await fireEvent.press(screen.getByTestId(`pf-pm-${pm.id}`));
    await fireEvent.press(screen.getByTestId('pf-submit'));
    expect(await screen.findByTestId('project-detail-screen')).toBeTruthy();
    const patch = api.fetchMock.mock.calls.find(([url, init]: [string, { method?: string }]) => url.endsWith('/projects/p1') && init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1].body))).toMatchObject({ projectManagerId: pm.id });
  });
});
