import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 7 - full high-side slab billed with 1 AHU pending; the true position stays visible', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.billing.plan = { id: 'bp1', status: 'approved', retentionPct: 5, highSideValue: 1000000, milestones: [{ id: 'm2', name: 'High-side delivery', stage: 'high_side_delivery', basis: 'percent', percent: 30, fixedAmount: 0, amount: 300000, billed: 0, linkedItemIds: ['i1'] }] };
  api.billing.position = { planStatus: 'approved', highSideValue: 1000000, lowSide: [], milestones: [{ id: 'm2', name: 'High-side delivery', amount: 300000, billed: 0, unbilled: 300000, linkedTotalQty: 10, linkedDoneQty: 9, pendingQty: 1, deliveredPct: 90, billedAheadOfDelivery: false, pending: [{ serialNo: '4', description: 'AHU 10000 CFM', pendingQty: 1, unit: 'Nos' }] }] };
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-billing'));
  const slab = await screen.findByTestId('slab-pos-High-side delivery');
  expect(slab).toHaveTextContent(/delivered 9\/10 \(90%\)/);
  expect(slab).toHaveTextContent(/Pending: S.No 4 AHU 10000 CFM — 1 Nos/);
  await fireEvent.changeText(screen.getByTestId('slab-amount-High-side delivery'), '280000');
  await fireEvent.press(screen.getByTestId('slab-bill-High-side delivery'));
  await waitFor(() => expect(api.billing.invoices).toHaveLength(1));
  expect(api.billing.invoices[0]).toMatchObject({ milestoneId: 'm2', amount: 280000 });
});
