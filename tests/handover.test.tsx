import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 9 - service head ticks every serial before accepting the handover', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.handover.current = { status: 'submitted', handoverDate: '2026-11-19', returnReason: null, equipment: [{ id: 'e1', name: 'Split AC', serialNo: 'SN1', verified: false, assetId: null }, { id: 'e2', name: 'Split AC', serialNo: 'SN2', verified: false, assetId: null }] };
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-handover'));
  expect(await screen.findByTestId('ho-accept')).toHaveTextContent('Accept (0/2 verified)');
  await fireEvent.press(screen.getByTestId('ho-unit-SN1'));
  await fireEvent.press(screen.getByTestId('ho-unit-SN2'));
  expect(screen.getByTestId('ho-accept')).toHaveTextContent('Accept (2/2 verified)');
  await fireEvent.press(screen.getByTestId('ho-accept'));
  await waitFor(() => expect(api.handover.decisions[0]).toEqual({ action: 'accept', verifiedSerials: ['SN1', 'SN2'] }));
});

test('5B - an expired AMC is renewed from the project with a new end date and value', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.handover.current = { status: 'accepted', handoverDate: '2025-11-19', returnReason: null, equipment: [] };
  api.handover.amcs.push({ id: 'a1', projectId: 'p1', number: 'AMC-0001', clientName: 'Lodha', startDate: '2025-11-20', endDate: '2026-11-19', contractValue: 120000, status: 'expired', daysToEnd: -5, assets: 2, revenue: 120000, expenses: 0, profit: 120000, marginPct: 100, visitsPerYear: 4, visits: { preventive: 4, complaints: 0, open: 0 }, schedule: [], customerId: null, technicianId: null, partsIncluded: false, nextVisitDate: null, cancellation: null });
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-handover'));
  await fireEvent.changeText(await screen.findByTestId('amc-renew-end-AMC-0001'), '2027-11-19');
  await fireEvent.changeText(screen.getByTestId('amc-renew-value-AMC-0001'), '1,32,000');
  await fireEvent.press(screen.getByTestId('amc-renew-AMC-0001'));
  await waitFor(() => expect(api.handover.renewals).toEqual([{ id: 'a1', body: { endDate: '2027-11-19', contractValue: 132000 } }]));
});
