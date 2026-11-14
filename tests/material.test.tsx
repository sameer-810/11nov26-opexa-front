import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

const row = (o: object) => ({ workOrderItemId: 'i1', serialNo: '1', description: 'Split AC', unit: 'Nos', boqQty: 10, requested: 6, ordered: 6, inTransit: 0, received: 6, damaged: 0, localPurchased: 0, transferredIn: 0, returned: 0, netSupplied: 6, installed: 0, atSite: 6, pending: 0, notOrdered: 0, awaitingDispatch: 0, boqBalance: 4, rate: 52000, ...o });

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const sup = api.addUser({ email: 'sunil@airtech.in', password: 'Sunil12345', role: 'supervisor', name: 'Sunil Site' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [sup.id] });
  api.materialRows.push(row({}));
  return api;
}

async function signIn(email: string, pw: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), pw);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}
async function openProject() {
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
}

describe('Phase 7 - Site side', () => {
  test('installation log: cannot install more than is at site', async () => {
    const api = setup();
    await signIn('sunil@airtech.in', 'Sunil12345');
    await openProject();
    await fireEvent.press(await screen.findByTestId('project-usage'));
    await fireEvent.press(await screen.findByTestId('usage-add'));
    await fireEvent.changeText(screen.getByTestId('usage-search'), 'split');
    await fireEvent.press(screen.getByTestId('usage-search-pick-1'));
    await fireEvent.changeText(screen.getByTestId('usage-qty-1'), '7');
    await fireEvent.press(screen.getByTestId('usage-save'));
    expect(screen.getByText('Only 6 Nos at site')).toBeTruthy();
    expect(api.usage).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId('usage-qty-1'), '4');
    await fireEvent.changeText(screen.getByTestId('usage-area'), 'Floor 3');
    await fireEvent.press(screen.getByTestId('usage-save'));
    expect(await screen.findByTestId('usage-message')).toHaveTextContent('Installation saved.');
    expect(api.usage[0]).toMatchObject({ area: 'Floor 3', lines: [{ workOrderItemId: 'i1', qty: 4 }] });
  });

  test('stock count: a difference needs a reason', async () => {
    const api = setup();
    api.materialRows[0].atSite = 2;
    await signIn('sunil@airtech.in', 'Sunil12345');
    await openProject();
    await fireEvent.press(await screen.findByTestId('project-stock-count'));
    await fireEvent.press(await screen.findByTestId('sc-start'));
    expect(screen.getByTestId('sc-count-1')).toHaveProp('value', '2');
    await fireEvent.changeText(screen.getByTestId('sc-count-1'), '1');
    await fireEvent.press(screen.getByTestId('sc-save'));
    expect(screen.getByText('Count differs from the books - say why')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('sc-reason-1'), 'One unit missing');
    await fireEvent.press(screen.getByTestId('sc-save'));
    expect(await screen.findByTestId('sc-SC-0001')).toHaveTextContent(/1 item\(s\) differ/);
    expect(api.counts[0].lines[0]).toMatchObject({ countedQty: 1, reason: 'One unit missing', variance: -1 });
  });

  test('return to vendor needs a vendor; owner confirms it', async () => {
    const api = setup();
    api.vendors.push({ id: 'v1', name: 'Cool Traders', phone: null, gstin: null, address: '', isActive: true });
    await signIn('sunil@airtech.in', 'Sunil12345');
    await openProject();
    await fireEvent.press(await screen.findByTestId('project-returns'));
    await fireEvent.press(await screen.findByTestId('return-new'));
    await screen.findByTestId('new-return-screen');
    await fireEvent.press(await screen.findByText('Back to vendor'));
    await fireEvent.changeText(screen.getByTestId('rt-search'), '1');
    await fireEvent.press(screen.getByTestId('rt-search-pick-1'));
    await fireEvent.changeText(screen.getByTestId('rt-qty-1'), '1');
    await fireEvent.changeText(screen.getByTestId('rt-reason'), 'Wrong model sent');
    await fireEvent.press(screen.getByTestId('rt-save'));
    expect(screen.getByText('Choose the vendor')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cool Traders'));
    await fireEvent.press(screen.getByTestId('rt-save'));
    expect(await screen.findByTestId('return-status')).toHaveTextContent('Waiting to confirm');
    expect(screen.queryByTestId('return-accept')).toBeNull(); // site cannot confirm its own return
    expect(api.returns[0]).toMatchObject({ type: 'vendor', vendorId: 'v1', reason: 'Wrong model sent' });
  });
});

describe('Phase 7 - Manager side', () => {
  test('owner sees returns waiting and confirms one', async () => {
    const api = setup();
    api.returns.push({
      id: 'rt1', number: 'RTN-0001', type: 'store', projectId: 'p1', projectName: 'Worli', vendor: null, toProject: null, reason: 'Extra', challanNo: null, status: 'pending',
      decidedBy: null, decidedAt: null, decisionNote: '', createdBy: { id: 'x', name: 'Sunil Site' }, createdAt: new Date().toISOString(),
      lines: [{ id: 'l1', workOrderItemId: 'i1', serialNo: '1', description: 'Split AC', unit: 'Nos', qty: 1, toWorkOrderItemId: null, toSerialNo: null }],
    });
    await signIn('owner@airtech.in', 'Owner12345');
    expect(await screen.findByText('Returns to confirm (1)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tile-returns'));
    await fireEvent.press(await screen.findByTestId('return-RTN-0001'));
    await fireEvent.press(await screen.findByTestId('return-reject'));
    expect(screen.getByTestId('return-error')).toHaveTextContent(/Write why/);
    await fireEvent.press(screen.getByTestId('return-accept'));
    expect(await screen.findByTestId('return-decided')).toHaveTextContent(/Confirmed by Someone/);
    expect(api.returns[0].status).toBe('accepted');
  });
});
