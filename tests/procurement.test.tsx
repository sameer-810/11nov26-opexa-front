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
    lines: [{ id: 'rl1', workOrderItemId: 'i1', serialNo: '1', description: 'Copper pipe', unit: 'Rmt', boqQty: 10, previouslyRequested: 0, qtyRequested: 10, overBy: 0, overrideReason: null }],
  });
  api.vendors.push({ id: 'v1', code: 'SUP-0001', name: 'Cool Traders', email: 'cool@x.in', materials: [], isActive: true }, { id: 'v2', code: 'SUP-0002', name: 'Pipe House', email: null, materials: [], isActive: true });
  return api;
}

async function signInAsBuyer() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'buyer@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Buyer12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('tile-procurement');
}

describe('Phase 3 - RFQ from a material request (buyer)', () => {
  test('choose suppliers, send the RFQ, and get one private link per supplier', async () => {
    const api = setup();
    await signInAsBuyer();
    await fireEvent.press(screen.getByTestId('tile-requisitions'));
    await fireEvent.press(await screen.findByTestId('req-MR-0001'));
    await fireEvent.press(await screen.findByTestId('create-rfq'));
    await screen.findByTestId('new-rfq-screen');

    // Without a supplier the RFQ is not sent.
    await fireEvent.press(await screen.findByTestId('rfq-send'));
    expect(screen.getByTestId('rfq-error')).toHaveTextContent(/at least one supplier/);
    expect(api.rfqs).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('rfq-vendor-Cool Traders'));
    await fireEvent.press(screen.getByTestId('rfq-vendor-Pipe House'));
    await fireEvent.changeText(screen.getByTestId('rfq-qty-1'), '8');
    await fireEvent.press(screen.getByTestId('rfq-send'));
    await screen.findByTestId('rfq-detail');
    expect(api.rfqs[0]).toMatchObject({ status: 'sent', lines: [{ qty: 8 }] });
    expect(await screen.findByTestId('rfq-link-Cool Traders')).toHaveTextContent(/\/public\/rfq\/token-v1$/);
    expect(screen.getByTestId('rfq-link-Pipe House')).toHaveTextContent(/token-v2/);
    expect(screen.getByTestId('rfq-status')).toHaveTextContent('Sent');
  });

  test('PO screen shows the delivery breakdown and procurement actions', async () => {
    const api = setup();
    api.pos.push({ id: 'po1', number: 'PO-0001', status: 'issued', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', vendor: { id: 'v1', name: 'Cool Traders', phone: null }, expectedDate: null, notes: '', cancelReason: null, createdAt: new Date().toISOString(), lots: [], lines: [{ id: 'pl1', requisitionId: 'r1', requisitionLineId: 'rl1', serialNo: '1', description: 'Copper pipe', unit: 'Rmt', qty: 10, rate: 500, dispatched: 4 }] });
    await signInAsBuyer();
    await fireEvent.press(screen.getByTestId('tile-pos'));
    await fireEvent.press(await screen.findByTestId('po-PO-0001'));
    expect(await screen.findByTestId('po-delivery-1')).toHaveTextContent(/ordered 10 · sent 4 · in transit 4 · accepted 0/);
    expect(screen.getByTestId('po-revise')).toBeTruthy();
    expect(screen.getByTestId('po-invoice')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('po-revise'));
    await fireEvent.press(await screen.findByTestId('rev-save'));
    expect(screen.getByTestId('rev-problem')).toHaveTextContent(/reason/);
  });
});
