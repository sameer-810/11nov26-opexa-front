import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'buyer@airtech.in', password: 'Buyer12345', role: 'purchaser', name: 'Sana Buyer' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 10, rate: 500, amount: 5000 });
  api.reqs.push({
    id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: 'u9', name: 'Ravi' }, note: '', neededBy: null,
    status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: false,
    lines: [{ id: 'rl1', workOrderItemId: 'i1', serialNo: '1', description: 'Item 1', unit: 'Nos', boqQty: 10, previouslyRequested: 0, qtyRequested: 10, overBy: 0, overrideReason: null }],
  });
  return api;
}

async function signInAsBuyer() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'buyer@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Buyer12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('tile-pos');
}

describe('Phase 5 - Purchase orders and dispatch lots (buyer)', () => {
  test('split one request across two vendors, then record a partial lot', async () => {
    const api = setup();
    await signInAsBuyer();
    await fireEvent.press(screen.getByTestId('tile-requisitions'));
    await fireEvent.press(await screen.findByTestId('req-MR-0001'));
    await fireEvent.press(await screen.findByTestId('create-po'));
    await screen.findByTestId('new-po-screen');

    // No vendors yet: add one inline.
    await fireEvent.press(screen.getByTestId('po-add-vendor'));
    await fireEvent.changeText(screen.getByTestId('vf-name'), 'Cool Traders');
    await fireEvent.press(screen.getByTestId('vf-save'));
    await screen.findByTestId('po-vendor-v1');

    // Too much is blocked before sending.
    await fireEvent.changeText(screen.getByTestId('po-qty-1'), '12');
    await fireEvent.press(screen.getByTestId('po-submit'));
    expect(screen.getByTestId('po-error')).toHaveTextContent(/more than what is left/);
    expect(api.pos).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('po-qty-1'), '6');
    await fireEvent.press(screen.getByTestId('po-submit'));
    await screen.findByTestId('po-detail-screen');
    expect(api.pos[0].lines[0]).toMatchObject({ qty: 6, rate: 500 });

    // Dispatch 4 of 6 as lot 1.
    await fireEvent.press(screen.getByTestId('record-dispatch'));
    await fireEvent.changeText(screen.getByTestId('d-challan'), 'CH-77');
    await fireEvent.changeText(screen.getByTestId('d-date'), '2026-11-10');
    await fireEvent.changeText(screen.getByTestId('d-qty-1'), '4');
    await fireEvent.press(screen.getByTestId('d-save'));
    expect(await screen.findByTestId('lot-1')).toHaveTextContent(/CH-77/);
    expect(screen.getByTestId('po-status')).toHaveTextContent(/Partly dispatched/);
    expect(api.pos[0].lines[0].dispatched).toBe(4);
  });

  test('cannot dispatch more than is pending on the PO', async () => {
    const api = setup();
    api.vendors.push({ id: 'v1', name: 'Cool Traders', phone: null, gstin: null, address: '', isActive: true });
    api.pos.push({
      id: 'po1', number: 'PO-0001', status: 'issued', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', vendor: { id: 'v1', name: 'Cool Traders', phone: null },
      expectedDate: null, notes: '', cancelReason: null, createdAt: new Date().toISOString(), lots: [],
      lines: [{ id: 'pl1', requisitionId: 'r1', requisitionLineId: 'rl1', serialNo: '1', description: 'Item 1', unit: 'Nos', qty: 3, rate: 500, dispatched: 0 }],
    });
    await signInAsBuyer();
    await fireEvent.press(screen.getByTestId('tile-pos'));
    await fireEvent.press(await screen.findByTestId('po-PO-0001'));
    await fireEvent.press(await screen.findByTestId('record-dispatch'));
    await fireEvent.changeText(screen.getByTestId('d-challan'), 'CH-1');
    await fireEvent.changeText(screen.getByTestId('d-date'), '2026-11-10');
    await fireEvent.changeText(screen.getByTestId('d-qty-1'), '5');
    await fireEvent.press(screen.getByTestId('d-save'));
    expect(await screen.findByTestId('dispatch-error')).toBeTruthy();
    expect(api.pos[0].lots).toHaveLength(0);
  });
});
