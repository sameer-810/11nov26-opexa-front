import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { routeForLink } from '../src/navigation/routeForLink';
import { splitSerials } from '../src/modules/service/api/serviceApi';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

async function signIn(email: string, pw: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), pw);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

const ticket = (over: Record<string, unknown> = {}) => ({
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa', number: 'SR-0001', kind: 'complaint', title: 'Not cooling', description: '', priority: 'urgent',
  project: { id: 'p1', code: 'P-001', name: 'Worli Tower' },
  asset: { id: 'as1', projectId: 'p1', projectName: null, name: 'Split AC', brand: 'Daikin', model: '', serialNo: 'D-001', location: 'Floor 3', installedOn: '2026-01-10', warrantyMonths: 12, warrantyEnd: '2027-01-10', underWarranty: true, pmEveryMonths: 3, nextPmDate: '2027-01-10' },
  contactName: 'Mr Shah', contactPhone: '9820000000', source: 'client-link', status: 'open', underWarranty: true, charge: 0, assignedTo: null,
  visits: [], createdAt: new Date().toISOString(), resolvedAt: null, closedAt: null, clientRating: null, ...over,
});

describe('Phase 14 - Service screens', () => {
  test('helpers: serial splitting and notification links', () => {
    expect(splitSerials('A1, A2\nA3\n\n')).toEqual(['A1', 'A2', 'A3']);
    expect(routeForLink('/app/service/aaaaaaaaaaaaaaaaaaaaaaaa', null)).toEqual({ name: 'TicketDetail', params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    expect(routeForLink('/app/service', null)).toEqual({ name: 'Service', params: undefined });
  });

  test('engineer assigns a client complaint to a technician', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'ravi@airtech.in', password: 'Ravi123456', role: 'engineer', name: 'Ravi' });
    api.addUser({ email: 'raju@airtech.in', password: 'Raju123456', role: 'staff', name: 'Raju' });
    api.service.tickets.push(ticket());
    await signIn('ravi@airtech.in', 'Ravi123456');
    expect(screen.getByTestId('tile-service')).toHaveTextContent(/Service & warranty/);
    await fireEvent.press(screen.getByTestId('tile-service'));
    const row = await screen.findByTestId('svc-row-SR-0001');
    expect(row).toHaveTextContent(/Urgent/);
    expect(row).toHaveTextContent(/In warranty/);
    expect(row).toHaveTextContent(/not assigned/);
    await fireEvent.press(row);
    await screen.findByTestId('ticket-screen');
    expect(screen.getByTestId('tk-warranty')).toHaveTextContent(/Under warranty - no charge/);
    expect(screen.getByTestId('tk-call')).toHaveTextContent(/Call Mr Shah: 9820000000/);
    await fireEvent.press(await screen.findByText('Raju'));
    await fireEvent.press(screen.getByTestId('tk-assign'));
    await waitFor(() => expect(screen.getByTestId('tk-status')).toHaveTextContent('Assigned'));
    expect(screen.getByTestId('tk-history')).toHaveTextContent(/Assigned to Raju/);
  });

  test('technician sees only their job and logs a visit; no charge field under warranty', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'raju@airtech.in', password: 'Raju123456', role: 'staff', name: 'Raju' });
    const raju = api.byEmail('raju@airtech.in')!;
    api.service.tickets.push(ticket({ status: 'assigned', assignedTo: { id: raju.id, name: 'Raju' } }), ticket({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', number: 'SR-0002', assignedTo: { id: 'other', name: 'Amit' } }));
    await signIn('raju@airtech.in', 'Raju123456');
    expect(screen.getByTestId('tile-service')).toHaveTextContent(/My service jobs/);
    await fireEvent.press(screen.getByTestId('tile-service'));
    await screen.findByTestId('svc-row-SR-0001');
    expect(screen.queryByTestId('svc-row-SR-0002')).toBeNull();
    expect(screen.queryByTestId('svc-new')).toBeNull();
    await fireEvent.press(screen.getByTestId('svc-row-SR-0001'));
    await screen.findByTestId('ticket-screen');
    expect(screen.queryByTestId('tk-assign')).toBeNull();
    expect(screen.queryByTestId('tk-charge')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('tk-note'), 'Gas leak fixed');
    await fireEvent.press(screen.getByText('Problem solved'));
    await fireEvent.press(screen.getByTestId('tk-save-visit'));
    await waitFor(() => expect(screen.getByTestId('tk-status')).toHaveTextContent('Resolved'));
    expect(api.service.visits[0]).toMatchObject({ note: 'Gas leak fixed', status: 'resolved' });
    expect(screen.queryByTestId('tk-save-visit')).toBeNull();
  });
});
