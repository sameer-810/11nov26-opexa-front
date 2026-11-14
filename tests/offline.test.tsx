import { screen, fireEvent, act } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { flushOutbox } from '../src/shared/offline/outbox';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

// Supervisor with Lot 1 (6 AC) on the way, like the Phase 6 tests.
function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const sup = api.addUser({ email: 'sunil@airtech.in', password: 'Sunil12345', role: 'supervisor', name: 'Sunil Site' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [sup.id] });
  api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 10, rate: 500, amount: 5000 });
  api.pos.push({
    id: 'po1', number: 'PO-0001', status: 'issued', projectId: 'p1', vendor: { id: 'v1', name: 'Cool Traders', phone: null }, lines: [{ id: 'pl1', serialNo: '1', qty: 10, rate: 500, dispatched: 6 }],
    lots: [{ id: 'lot1', lotNo: 1, challanNo: 'CH-9', dispatchDate: '2026-11-10', vehicleNo: null, receivedAt: null, lines: [{ id: 'dl1', poLineId: 'pl1', serialNo: '1', description: 'Split AC', unit: 'Nos', qty: 6 }] }],
  });
  return api;
}

describe('Phase 9 - Offline mode', () => {
  test('lot opened online, checked in offline: saved on phone, sent once when back online', async () => {
    const api = setup();
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'sunil@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Sunil12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await fireEvent.press(await screen.findByTestId('tile-receive'));
    await fireEvent.press(await screen.findByTestId('project-lot-1'));
    await screen.findByTestId('rcv-good-1');

    api.net.offline = true; // signal lost at site
    await fireEvent.changeText(screen.getByTestId('rcv-good-1'), '5');
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    expect(await screen.findByTestId('lot-message')).toHaveTextContent(/Saved on this phone/);
    expect(await screen.findByTestId('offline-pending')).toHaveTextContent(/1 change saved on this device/);
    expect(screen.getByTestId('offline-status')).toHaveTextContent(/You are offline/);
    expect(api.pos[0].lots[0].receivedAt).toBeNull();

    // Still offline: sending again keeps it waiting.
    await act(async () => {
      await flushOutbox();
    });
    expect(api.pos[0].lots[0].receivedAt).toBeNull();

    api.net.offline = false;
    await act(async () => {
      await flushOutbox();
    });
    expect(api.pos[0].lots[0].lines[0]).toMatchObject({ qtyReceived: 5 });
    expect(screen.queryByTestId('offline-pending')).toBeNull();
    const receives = api.fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/receive') && i?.method === 'POST');
    expect(receives.every(([, i]) => i?.headers?.['Idempotency-Key'])).toBe(true);
  });

  test('screens seen before still open offline (saved copy)', async () => {
    const api = setup();
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'sunil@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Sunil12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await fireEvent.press(await screen.findByTestId('tile-receive'));
    await screen.findByTestId('project-lot-1');
    await fireEvent.press(screen.getByTestId('back')); // project page (online)
    await screen.findByTestId('project-lots');
    api.net.offline = true;
    await fireEvent.press(screen.getByTestId('project-lots'));
    expect(await screen.findByTestId('project-lot-1')).toBeTruthy();
    expect(await screen.findByTestId('offline-status')).toHaveTextContent(/saved on this device/);
  });

  test('an action refused when finally sent shows up to be removed', async () => {
    const api = setup();
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'sunil@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Sunil12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await fireEvent.press(await screen.findByTestId('tile-receive'));
    await fireEvent.press(await screen.findByTestId('project-lot-1'));
    await screen.findByTestId('rcv-good-1');
    api.net.offline = true;
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    await screen.findByTestId('offline-pending');
    // Meanwhile a manager checked the lot in from the office.
    api.pos[0].lots[0].receivedAt = new Date().toISOString();
    api.net.offline = false;
    await act(async () => {
      await flushOutbox();
    });
    expect(await screen.findByTestId('offline-failed')).toHaveTextContent(/1 change could not be sent/);
    await fireEvent.press(screen.getByTestId('offline-open-outbox'));
    expect(await screen.findByTestId('outbox-error')).toHaveTextContent(/Already checked in/);
    await fireEvent.press(screen.getByTestId('outbox-discard'));
    expect(await screen.findByText('Nothing waiting')).toBeTruthy();
  });
});
