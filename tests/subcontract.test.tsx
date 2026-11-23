import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 6 - work recorded against a work order and certified for payment', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.subcontract.subs.push({ id: 's1', code: 'SC-0001', name: 'Cool Fitters', phone: '', gstin: null, categories: [], isActive: true });
  api.subcontract.agreements.push({ id: 'a1', number: 'SCA-0001', subcontractorId: 's1', projectId: 'p1', title: 'Piping', retentionPct: 5, advanceRecoveryPct: 0, status: 'active', revision: 0 });
  api.subcontract.wos.push({ id: 'w1', number: 'SWO-0001', agreementId: 'a1', subcontractorId: 's1', projectId: 'p1', status: 'approved', value: 60000, approvedValue: 0, progressPct: 0, lines: [{ id: 'l1', serialNo: '1', description: 'Copper piping', unit: 'Rmt', qty: 1000, rate: 60, approvedQty: 0, enteredQty: 0, pendingQty: 1000, progressPct: 0 }] });
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-subcontract'));
  await fireEvent.changeText(await screen.findByTestId('wo-enter-SWO-0001-1'), '100');
  await fireEvent.press(screen.getByTestId('wo-save-SWO-0001-1'));
  await screen.findByTestId('wo-SWO-0001');
  expect(api.subcontract.progress[0]).toMatchObject({ workOrderId: 'w1', lineId: 'l1', qty: 100 });
  await fireEvent.press(screen.getByText('Certificates'));
  await fireEvent.press(await screen.findByTestId('certify-SWO-0001'));
  expect(await screen.findByTestId('cert-PC-0001')).toHaveTextContent(/net ₹5,700/);
  expect(screen.getByTestId('cert-line-PC-0001-0')).toHaveTextContent(/Copper pipe: 50 Rmt certified \(50 of 60 reported\) @ ₹120/);
});
