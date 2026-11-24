import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installStockControlMock } from './helpers/mockStockControlApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

const PIPE = { materialId: 'm1', code: 'MAT-00001', name: 'Copper pipe', unit: 'Rmt', location: { kind: 'warehouse', id: 'w1', name: 'Central Store' }, onHand: 100, reserved: 0, available: 100, damaged: 0, value: 50000, avgRate: 500, minStock: 0, low: false };
const RODS = { ...PIPE, materialId: 'm2', code: 'MAT-00002', name: 'Brazing rods', unit: 'Kg', onHand: 20, available: 20, value: 2000, avgRate: 100 };

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-store'));
}
function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345', name: 'Owner' });
  const store = api.addUser({ email: 'store@airtech.in', password: 'Store12345', role: 'store_incharge', name: 'Store' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [store.id] });
  api.inventory.stock.push({ ...PIPE }, { ...RODS });
  return { api, mock: installStockControlMock(api) };
}

describe('2F.4 - Physical count', () => {
  test('start a warehouse count, enter counted and damaged, see the variance, submit and approve', async () => {
    const { mock } = setup();
    await signIn('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('store-tab-counts'));
    await fireEvent.press(await screen.findByTestId('count-location-w1'));
    await fireEvent.press(screen.getByTestId('count-start'));
    await screen.findByTestId('count-sheet');
    expect(screen.getByTestId('count-totals')).toHaveTextContent(/^Short ₹0(\.00)? · excess/); // never "-₹0.00"
    expect(mock.calls[0]).toMatchObject({ method: 'POST', path: '/inventory/counts', body: { location: { kind: 'warehouse', id: 'w1' }, scope: { type: 'all' } } });

    await fireEvent.changeText(screen.getByTestId('count-qty-MAT-00001'), '92');
    await fireEvent.changeText(screen.getByTestId('count-dmg-MAT-00001'), '3');
    await fireEvent.changeText(screen.getByTestId('count-qty-MAT-00002'), '22');
    await fireEvent.press(screen.getByTestId('count-save'));
    expect(await screen.findByTestId('count-var-MAT-00001')).toHaveTextContent(/Variance -5 Rmt.*3 found damaged/);
    expect(screen.getByTestId('count-totals')).toHaveTextContent(/Short ₹2,500.*excess ₹200.*net -?₹-?2,300/);

    await fireEvent.press(screen.getByTestId('count-submit'));
    await waitFor(() => expect(screen.getByTestId('count-status')).toHaveTextContent('Waiting for approval'));
    await fireEvent.press(screen.getByTestId('count-approve'));
    await waitFor(() => expect(screen.getByTestId('count-status')).toHaveTextContent('Approved, posted'));
    expect(mock.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /inventory/counts', 'PUT /inventory/counts/c1/lines', 'POST /inventory/counts/c1/submit', 'POST /inventory/adjustments/adj-c1/decision']);
    expect(mock.calls[1].body).toEqual({ lines: [{ materialId: 'm1', countedQty: 92, damagedQty: 3 }, { materialId: 'm2', countedQty: 22 }] });
  });

  test('store staff cannot approve their own count', async () => {
    setup();
    await signIn('store@airtech.in', 'Store12345');
    await fireEvent.press(await screen.findByTestId('store-tab-counts'));
    await fireEvent.press(await screen.findByTestId('count-location-w1'));
    await fireEvent.press(screen.getByTestId('count-start'));
    await fireEvent.changeText(await screen.findByTestId('count-qty-MAT-00001'), '100');
    await fireEvent.changeText(screen.getByTestId('count-qty-MAT-00002'), '20');
    await fireEvent.press(screen.getByTestId('count-save'));
    await screen.findByTestId('count-var-MAT-00002');
    await fireEvent.press(screen.getByTestId('count-submit'));
    await waitFor(() => expect(screen.getByTestId('count-status')).toHaveTextContent('Waiting for approval'));
    expect(screen.queryByTestId('count-approve')).toBeNull();
  });

  test('a rate can be entered only for stock with no known rate', async () => {
    const { api, mock } = setup();
    api.inventory.stock.push({ ...PIPE, materialId: 'm3', code: 'MAT-00003', name: 'Insulation tape', unit: 'Nos', onHand: 0, available: 0, value: 0, avgRate: 0 });
    await signIn('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('store-tab-counts'));
    await fireEvent.press(await screen.findByTestId('count-location-w1'));
    await fireEvent.press(screen.getByTestId('count-start'));
    expect(await screen.findByTestId('count-rate-MAT-00003')).toHaveTextContent(/no rate known/);
    expect(screen.queryByTestId('count-rate-input-MAT-00001')).toBeNull();
    expect(screen.getByLabelText('Rate ₹ (no rate known)')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('count-qty-MAT-00001'), '100');
    await fireEvent.changeText(screen.getByTestId('count-qty-MAT-00003'), '4');
    await fireEvent.changeText(screen.getByTestId('count-rate-input-MAT-00003'), '250');
    await fireEvent.press(screen.getByTestId('count-save'));
    expect(await screen.findByTestId('count-var-MAT-00003')).toHaveTextContent(/Variance \+4 Nos \(₹1,000/);
    expect(screen.getByTestId('count-rate-MAT-00003')).toHaveTextContent(/₹250.*\(entered\)/);
    expect(mock.calls[1].body).toEqual({ lines: [{ materialId: 'm1', countedQty: 100 }, { materialId: 'm3', countedQty: 4, rate: 250 }] });
  });
});

describe('Warehouses - add and edit (admin)', () => {
  test('owner adds a warehouse and edits one', async () => {
    const { mock } = setup();
    await signIn('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('store-tab-warehouses'));
    await fireEvent.press(await screen.findByTestId('warehouse-add'));
    await fireEvent.press(screen.getByTestId('warehouse-save'));
    expect(screen.getByTestId('warehouse-problem')).toHaveTextContent('Enter the warehouse name');
    await fireEvent.changeText(screen.getByTestId('warehouse-name'), 'Thane');
    await fireEvent.changeText(screen.getByTestId('warehouse-code'), 'THN');
    await fireEvent.changeText(screen.getByTestId('warehouse-address'), 'Wagle Estate');
    await fireEvent.press(screen.getByTestId('warehouse-save'));
    expect(await screen.findByTestId('warehouse-THN')).toHaveTextContent(/Thane.*Wagle Estate/);
    expect(mock.calls[0]).toEqual({ method: 'POST', path: '/inventory/warehouses', body: { name: 'Thane', code: 'THN', address: 'Wagle Estate' } });

    await fireEvent.press(screen.getByTestId('warehouse-edit-BHW'));
    await fireEvent.changeText(screen.getByTestId('warehouse-name'), 'Bhiwandi Store');
    await fireEvent.press(screen.getByTestId('warehouse-active-no'));
    await fireEvent.press(screen.getByTestId('warehouse-save'));
    expect(await screen.findByTestId('warehouse-BHW')).toHaveTextContent(/Bhiwandi Store.*Inactive/);
    expect(mock.calls[1]).toEqual({ method: 'PATCH', path: '/inventory/warehouses/w2', body: { name: 'Bhiwandi Store', code: 'BHW', address: '', isActive: false } });
    await fireEvent.press(screen.getByTestId('warehouse-edit-CS'));
    expect(screen.queryByTestId('warehouse-active-no')).toBeNull(); // the Central Store stays active
  });

  test('store staff do not get the warehouses section', async () => {
    setup();
    await signIn('store@airtech.in', 'Store12345');
    await screen.findByTestId('store-tab-counts');
    expect(screen.queryByTestId('store-tab-warehouses')).toBeNull();
  });
});

describe('2F.5 and Q16 - minimum per store and damaged stock (store in-charge)', () => {
  test('sets a warehouse minimum and reorder quantity; marks stock damaged', async () => {
    const { mock } = setup();
    await signIn('store@airtech.in', 'Store12345');
    await fireEvent.press(await screen.findByTestId('level-open-MAT-00002'));
    await fireEvent.changeText(screen.getByTestId('level-min-MAT-00002'), '30');
    await fireEvent.changeText(screen.getByTestId('level-reorder-MAT-00002'), '50');
    await fireEvent.press(screen.getByTestId('level-save-MAT-00002'));
    expect(await screen.findByText(/Below minimum 30 · reorder 50/)).toBeTruthy();
    expect(mock.calls[0]).toMatchObject({ method: 'PUT', path: '/inventory/stock-levels', body: { materialId: 'm2', location: { kind: 'warehouse', id: 'w1' }, minQty: 30, reorderQty: 50 } });

    await fireEvent.press(screen.getByTestId('damaged-open-MAT-00001'));
    await fireEvent.changeText(screen.getByTestId('damaged-qty'), '150');
    await fireEvent.changeText(screen.getByTestId('damaged-reason'), 'Dented in store');
    await fireEvent.press(screen.getByTestId('damaged-save'));
    expect(screen.getByTestId('damaged-problem')).toHaveTextContent(/Only 100 Rmt free here/);
    await fireEvent.changeText(screen.getByTestId('damaged-qty'), '4');
    await fireEvent.press(screen.getByTestId('damaged-save'));
    expect(await screen.findByTestId('damaged-done')).toHaveTextContent('Saved.');
    expect(mock.calls[1]).toMatchObject({ method: 'POST', path: '/inventory/damaged/mark', body: { warehouseId: 'w1', materialId: 'm1', qty: 4, reason: 'Dented in store' } });
  });
});

describe('2G - Tools', () => {
  test('issue with condition and project, return with date and condition, repair back to good, history', async () => {
    const { mock } = setup();
    await signIn('store@airtech.in', 'Store12345');
    await fireEvent.press(await screen.findByTestId('store-tab-tools'));
    await fireEvent.changeText(await screen.findByTestId('tool-name'), 'Hilti drill');
    await fireEvent.changeText(screen.getByTestId('tool-serial'), 'HD-77');
    await fireEvent.press(screen.getByTestId('tool-add'));
    await fireEvent.press(await screen.findByTestId('tool-issue-TL-0001'));
    await fireEvent.changeText(screen.getByTestId('tool-holder'), 'Cool Fitters');
    await fireEvent.press(screen.getByTestId('tool-condition-fair'));
    await fireEvent.press(screen.getByTestId('tool-project-p1'));
    await fireEvent.changeText(screen.getByTestId('tool-due'), '2026-12-01');
    await fireEvent.press(screen.getByTestId('tool-issue-save'));
    expect(await screen.findByText(/With Cool Fitters.*issued fair/)).toBeTruthy();
    expect(mock.calls[1].body).toEqual({ holder: { kind: 'employee', name: 'Cool Fitters' }, projectId: 'p1', expectedReturn: '2026-12-01', condition: 'fair' });

    await fireEvent.press(screen.getByTestId('tool-return-TL-0001'));
    await fireEvent.changeText(screen.getByTestId('tool-date'), '2026-11-18');
    await fireEvent.press(screen.getByTestId('tool-return-save'));
    expect(await screen.findByTestId('tool-problem-TL-0001')).toHaveTextContent(/cannot be before the issue date/); // shown on the card, not only at the top
    await fireEvent.changeText(screen.getByTestId('tool-date'), '2026-11-20');
    await fireEvent.press(screen.getByTestId('tool-condition-damaged'));
    await fireEvent.changeText(screen.getByTestId('tool-text'), 'Motor burnt');
    await fireEvent.press(screen.getByTestId('tool-return-save'));
    await screen.findByTestId('tool-repair-TL-0001');
    expect(mock.calls[3].body).toEqual({ condition: 'damaged', returnedAt: '2026-11-20', remarks: 'Motor burnt' });
    expect(screen.queryByTestId('tool-issue-TL-0001')).toBeNull(); // a damaged tool is repaired before it is issued

    await fireEvent.press(screen.getByTestId('tool-repair-TL-0001'));
    await fireEvent.changeText(screen.getByTestId('tool-vendor'), 'Hilti service centre');
    await fireEvent.press(screen.getByTestId('tool-repair-save'));
    expect(await screen.findByTestId('tool-status-TL-0001')).toHaveTextContent('In repair');
    await fireEvent.press(await screen.findByTestId('tool-repaired-TL-0001'));
    await fireEvent.changeText(screen.getByTestId('tool-amount'), '3500');
    await fireEvent.press(screen.getByTestId('tool-project-p1'));
    await fireEvent.press(screen.getByTestId('tool-repaired-save'));
    await screen.findByTestId('tool-issue-TL-0001');
    expect(mock.calls[5].body).toMatchObject({ cost: 3500, projectId: 'p1' });

    await fireEvent.press(screen.getByTestId('tool-history-TL-0001'));
    expect(await screen.findByTestId('tool-maint-tm1')).toHaveTextContent(/repair · ₹3,500(.00)? · P-001 Worli/);
    expect(screen.getByTestId('tool-history')).toHaveTextContent(/Repaired.*Sent for repair.*Returned · Cool Fitters · damaged · Motor burnt.*Issued/);
  });

  test('lost with responsibility and an amount to recover; a duplicate serial is refused', async () => {
    const { mock } = setup();
    await signIn('store@airtech.in', 'Store12345');
    await fireEvent.press(await screen.findByTestId('store-tab-tools'));
    await fireEvent.changeText(await screen.findByTestId('tool-name'), 'Hilti drill');
    await fireEvent.changeText(screen.getByTestId('tool-serial'), 'HD-77');
    await fireEvent.press(screen.getByTestId('tool-add'));
    await screen.findByTestId('tool-TL-0001');
    await fireEvent.changeText(screen.getByTestId('tool-name'), 'Second drill');
    await fireEvent.changeText(screen.getByTestId('tool-serial'), 'hd-77');
    await fireEvent.press(screen.getByTestId('tool-add'));
    expect(await screen.findByTestId('tools-problem')).toHaveTextContent(/already on TL-0001/);

    await fireEvent.press(screen.getByTestId('tool-missing-TL-0001'));
    await fireEvent.press(screen.getByText('Subcontractor'));
    await fireEvent.changeText(screen.getByTestId('tool-responsible'), 'Cool Fitters');
    await fireEvent.changeText(screen.getByTestId('tool-amount'), '4000');
    await fireEvent.changeText(screen.getByTestId('tool-text'), 'Lost at Worli site');
    await fireEvent.press(screen.getByTestId('tool-missing-save'));
    await screen.findByTestId('tool-found-TL-0001');
    expect(mock.calls.at(-1)?.body).toEqual({ action: 'missing', note: 'Lost at Worli site', responsible: { kind: 'subcontractor', name: 'Cool Fitters' }, recoveryAmount: 4000 });
  });
});
