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
