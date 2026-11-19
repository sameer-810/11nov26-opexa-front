import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 5 - owner sees estimated vs forecast margin and saves a line estimate', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.finance.financials = {
    revenue: { contract: 1000000, billed: 200000, workDone: 300000 }, estimate: { cost: 880000, margin: 120000, marginPct: 12 }, actual: { cost: 500000 }, committed: { cost: 450000 },
    consumedMaterial: 100000, materialAtSite: 50000, supplierInvoiced: 300000, forecast: { cost: 950000, margin: 50000, marginPct: 5 }, marginOnBilled: { value: -300000, pct: -150 },
    categories: [{ key: 'material', estimate: 600000, actual: 400000, committed: 450000, variance: -200000, forecast: 850000 }], overrun: true, lines: [], notes: ['GST is excluded from cost (input credit).'],
  };
  api.finance.estimate = { revenue: 1000000, cost: 880000, margin: 120000, marginPct: 12, overheadEstimate: 0, costAlertPct: 5, boqLocked: false, boqRevision: 0, lines: [{ workOrderItemId: 'i1', serialNo: '1', description: 'Split AC', unit: 'Nos', quantity: 10, rate: 100000, tendered: true, perUnit: { material: 60000, labour: 0, subcontract: 0, equipment: 0, other: 0 }, totalCost: 600000, revenue: 1000000, margin: 400000, marginPct: 40 }] };
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-finance'));
  expect(await screen.findByText(/Margin: estimated 12% → forecast 5%/)).toBeTruthy();
  expect(screen.getByText(/cost is above the estimate/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Estimate'));
  await fireEvent.changeText(await screen.findByTestId('est-1-labour'), '2500');
  await fireEvent.press(screen.getByTestId('est-save'));
  await screen.findByTestId('pf-estimate');
  expect(api.finance.saved[0].lines[0]).toMatchObject({ workOrderItemId: 'i1', material: 60000, labour: 2500 });
});
