import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installSupplierPaymentMock } from './helpers/mockSupplierPaymentApi';
import { installStockControlMock } from './helpers/mockStockControlApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ name: 'bank-advice.pdf', uri: 'file:///bank-advice.pdf', mimeType: 'application/pdf' }] })) }));

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}
type Call = [string, { method?: string; body?: unknown }];
const sent = (calls: Call[], path: string) => calls.filter(([url, init]) => url.endsWith(path) && init?.method === 'POST').map(([, init]) => JSON.parse(String(init.body)));

describe('Phase 2 leftovers', () => {
  test('lot check-in above the lot quantity asks for an over-receipt reason and sends it', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    const sup = api.addUser({ email: 'sunil@airtech.in', password: 'Sunil12345', role: 'supervisor', name: 'Sunil' });
    api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [sup.id] });
    api.pos.push({
      id: 'po1', number: 'PO-0001', status: 'issued', projectId: 'p1', vendor: { id: 'v1', name: 'Cool Traders', phone: null }, lines: [{ id: 'pl1', serialNo: '1', qty: 10, rate: 500, dispatched: 6 }],
      lots: [{ id: 'lot1', lotNo: 1, challanNo: 'CH-9', dispatchDate: '2026-11-10', vehicleNo: null, receivedAt: null, lines: [{ id: 'dl1', poLineId: 'pl1', serialNo: '1', description: 'Split AC', unit: 'Nos', qty: 6 }] }],
    });
    await signIn('sunil@airtech.in', 'Sunil12345');
    await fireEvent.press(screen.getByTestId('tile-receive'));
    await fireEvent.press(await screen.findByTestId('project-lot-1'));
    await fireEvent.changeText(await screen.findByTestId('rcv-good-1'), '8');
    expect(screen.getByTestId('rcv-over-reason')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    expect(screen.getByTestId('rcv-error')).toHaveTextContent(/Check the quantities/);
    expect(screen.getByText(/Only 6 Nos came in this lot. Give a reason below/)).toBeTruthy();
    expect(api.pos[0].lots[0].receivedAt).toBeNull();

    await fireEvent.changeText(screen.getByTestId('rcv-over-reason'), 'Vendor sent 2 extra; site needs them');
    await fireEvent.press(screen.getByTestId('rcv-submit'));
    await screen.findByTestId('lot-message');
    expect(sent(api.fetchMock.mock.calls as Call[], '/lots/lot1/receive')[0]).toMatchObject({ overReceiptReason: 'Vendor sent 2 extra; site needs them', lines: [{ lineId: 'dl1', qtyReceived: 8, qtyDamaged: 0 }] });
  });

  test('new PO: custody store chips default to the Central Store; choosing another sends it', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'buyer@airtech.in', password: 'Buyer12345', role: 'purchaser', name: 'Sana' });
    api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
    api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 10, rate: 500, amount: 5000 });
    api.vendors.push({ id: 'v1', name: 'Cool Traders', isActive: true, phone: null });
    api.reqs.push({
      id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: 'u9', name: 'Ravi' }, note: '', neededBy: null, status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: false,
      lines: [{ id: 'rl1', workOrderItemId: 'i1', serialNo: '1', description: 'Item 1', unit: 'Nos', boqQty: 10, previouslyRequested: 0, qtyRequested: 10, overBy: 0, overrideReason: null }],
    });
    installStockControlMock(api);
    await signIn('buyer@airtech.in', 'Buyer12345');
    await fireEvent.press(screen.getByTestId('tile-requisitions'));
    await fireEvent.press(await screen.findByTestId('req-MR-0001'));
    await fireEvent.press(await screen.findByTestId('create-po'));
    await fireEvent.press(await screen.findByTestId('po-custody-w2'));
    await fireEvent.press(screen.getByTestId('po-vendor-v1'));
    expect(screen.getByTestId('po-custody-w1')).toHaveTextContent(/Central Store/);
    await fireEvent.press(screen.getByTestId('po-submit'));
    await screen.findByTestId('po-detail-screen');
    expect(sent(api.fetchMock.mock.calls as Call[], '/purchase-orders')[0]).toMatchObject({ requisitionId: 'r1', vendorId: 'v1', custodyWarehouseId: 'w2' });
  });

  test('supplier payment: attach proof on the form and on the payment screen', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'meena@airtech.in', password: 'Meena12345', role: 'accounts', name: 'Meena', permissions: ['invoice.create', 'invoice.edit', 'reports.view', 'attendance.self', 'supplierInvoice.verify'] });
    const sp = installSupplierPaymentMock(api);
    const mock = installStockControlMock(api, { payments: sp.payments });
    await signIn('meena@airtech.in', 'Meena12345');
    await fireEvent.press(await screen.findByTestId('tile-payables'));
    await fireEvent.press(await screen.findByTestId('pay-vendor-Cool Traders'));
    await screen.findByTestId('spay-inv-CT/101');
    await fireEvent.changeText(screen.getByTestId('spay-amount'), '5000');
    await fireEvent.press(screen.getByTestId('req-attach'));
    expect(await screen.findByText('bank-advice.pdf (to upload)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('spay-save'));
    await screen.findByTestId('supplier-payment-detail');
    expect(await screen.findByTestId('req-attachment-list')).toHaveTextContent(/Attachments \(1\).*bank-advice\.pdf/);
    await fireEvent.press(screen.getByTestId('spay-attach'));
    await waitFor(() => expect(screen.getByTestId('req-attachment-list')).toHaveTextContent(/Attachments \(2\)/));
    expect(mock.calls.filter((c) => c.path === '/supplier-payments/sp1/attachments')).toHaveLength(2);
  });
});
