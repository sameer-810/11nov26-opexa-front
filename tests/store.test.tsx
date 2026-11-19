import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

async function signIn(email: string, password: string, tile: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId(tile);
}

describe('Phase 4 - Store (store in-charge)', () => {
  test('sees stock with low-stock flag and registers then issues a tool', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'store@airtech.in', password: 'Store12345', role: 'store_incharge', name: 'Store' });
    api.inventory.stock.push({ materialId: 'm1', code: 'MAT-00001', name: 'Copper pipe', unit: 'Rmt', location: { kind: 'warehouse', id: 'w1', name: 'Central Store' }, onHand: 40, reserved: 10, available: 30, value: 20000, avgRate: 500, minStock: 100, low: true });
    await signIn('store@airtech.in', 'Store12345', 'tile-store');
    await fireEvent.press(screen.getByTestId('tile-store'));
    expect(await screen.findByTestId('stock-MAT-00001-warehouse')).toHaveTextContent(/Below minimum 100.*on hand 40 Rmt · reserved 10 · available 30/);
    expect(screen.getByTestId('stock-total')).toHaveTextContent(/20,000/);

    await fireEvent.press(screen.getByText('Tools'));
    await fireEvent.changeText(await screen.findByTestId('tool-name'), 'Hilti drill');
    await fireEvent.press(screen.getByTestId('tool-add'));
    await fireEvent.press(await screen.findByTestId('tool-issue-TL-0001'));
    await fireEvent.changeText(screen.getByTestId('tool-holder'), 'Cool Fitters');
    await fireEvent.press(screen.getByTestId('tool-issue-save'));
    expect(await screen.findByText(/With Cool Fitters/)).toBeTruthy();
    expect(api.inventory.tools[0]).toMatchObject({ status: 'issued' });
  });
});

describe('Phase 4 - package material on a material request (engineer)', () => {
  test('adds copper pipe against a BOQ line as non-billable', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    const eng = api.addUser({ email: 'eng@airtech.in', password: 'Eng12345', role: 'engineer', name: 'Ravi' });
    api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
    api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1.1', quantity: 2, rate: 90000, amount: 180000 });
    api.inventory.materials.push({ id: 'm1', code: 'MAT-00001', name: 'Copper pipe 3/8', unit: 'Rmt', category: null, minStock: 0, isActive: true });
    await signIn('eng@airtech.in', 'Eng12345', 'tile-projects');
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));
    await fireEvent.press(await screen.findByTestId('project-new-requisition'));
    await fireEvent.press(await screen.findByTestId('pkg-open'));
    await fireEvent.press(screen.getByTestId('pkg-parent-i1'));
    await fireEvent.press(await screen.findByTestId('pkg-mat-MAT-00001'));
    await fireEvent.changeText(screen.getByTestId('pkg-qty-0'), '120');
    await fireEvent.press(screen.getByTestId('req-submit'));
    await screen.findByTestId('requisition-detail-screen');
    expect(api.reqs[0].lines).toEqual([expect.objectContaining({ billable: false, materialId: 'm1', qtyRequested: 120 })]);
  });
});
