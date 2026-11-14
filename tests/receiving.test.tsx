import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

// One project with Lot 1 (6 Split AC) on the way; Sunil is the site supervisor on it.
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

async function signIn() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'sunil@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Sunil12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
}

describe('Phase 6 - Site receiving (supervisor)', () => {
  test('dashboard shows the lot; checking it in short tells what came', async () => {
    const api = setup();
    await signIn();
    expect(await screen.findByText('Deliveries to check in (1)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tile-receive'));
    expect(await screen.findByTestId('lot-status-1')).toHaveTextContent('On the way');
    await fireEvent.press(screen.getByTestId('project-lot-1'));
    await screen.findByTestId('lot-detail-screen');
    expect(await screen.findByTestId('rcv-good-1')).toHaveProp('value', '6'); // starts with "all arrived"

    // Too many is caught before sending.
    await fireEvent.changeText(screen.getByTestId('rcv-good-1'), '6');
    await fireEvent.changeText(screen.getByTestId('rcv-damaged-1'), '1');
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    expect(screen.getByTestId('rcv-error')).toHaveTextContent(/Check the quantities/);
    expect(api.pos[0].lots[0].receivedAt).toBeNull();

    await fireEvent.changeText(screen.getByTestId('rcv-good-1'), '4');
    await fireEvent.changeText(screen.getByTestId('rcv-remark-1'), 'box crushed');
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    expect(await screen.findByTestId('lot-message')).toHaveTextContent(/buyer has been told/);
    expect(screen.getByTestId('lot-status')).toHaveTextContent('Received short');
    expect(screen.getByTestId('lot-result-1')).toHaveTextContent(/Good 4 · damaged 1 · short 1 · box crushed/);
    expect(screen.queryByTestId('rcv-submit')).toBeNull();
    expect(api.pos[0].lots[0].lines[0]).toMatchObject({ qtyReceived: 4, qtyDamaged: 1, remark: 'box crushed' });
  });

  test('local purchase: pick a BOQ item, reason required, over-BOQ is flagged', async () => {
    const api = setup();
    await signIn();
    await fireEvent.press(await screen.findByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));
    await fireEvent.press(await screen.findByTestId('project-local-purchase'));
    await fireEvent.press(await screen.findByTestId('lp-add'));
    await fireEvent.press(screen.getByTestId('lp-save'));
    expect(screen.getByTestId('lp-search-error')).toHaveTextContent(/Choose the BOQ item/);
    expect(screen.getByTestId('lp-reason-error')).toHaveTextContent(/Say why/);

    await fireEvent.changeText(screen.getByTestId('lp-search'), '1');
    await fireEvent.press(screen.getByTestId('lp-pick-1'));
    await fireEvent.changeText(screen.getByTestId('lp-qty'), '12');
    await fireEvent.changeText(screen.getByTestId('lp-rate'), '480');
    await fireEvent.changeText(screen.getByTestId('lp-vendor'), 'Lamington Road Hardware');
    await fireEvent.changeText(screen.getByTestId('lp-reason'), 'Vendor late, work stopped');
    await fireEvent.press(screen.getByTestId('lp-save'));
    expect(await screen.findByTestId('lp-message')).toHaveTextContent(/LP-0001 saved. Note: this goes 2 Nos over the BOQ/);
    expect(await screen.findByTestId('lp-LP-0001')).toHaveTextContent(/Over BOQ by 2/);
    expect(api.localPurchases[0]).toMatchObject({ qty: 12, rate: 480, vendorName: 'Lamington Road Hardware' });
  });
});
