import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 8 - retention due for release is flagged and claimed; expiring BG is flagged', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.commitments.retention = { totalOutstanding: 10400, byClient: [{ client: 'Lodha', outstanding: 10400 }], rows: [{ projectId: 'p1', projectCode: 'P-001', projectName: 'Worli', client: 'Lodha', held: 10400, released: 0, claimedOpen: 0, outstanding: 10400, releaseDueDate: '2026-10-01', due: true, daysToRelease: -49, retentionPct: 5, retentionBase: 'taxable', dlpMonths: 24 }] };
  api.commitments.bgs = { outstanding: 260000, expiringSoon: 1, expiredNotClosed: 0, rows: [{ id: 'b1', number: 'BG/0042', type: 'performance', bank: 'HDFC Bank', beneficiary: 'Lodha', amount: 260000, expiryDate: '2026-12-09', status: 'active', daysToExpiry: 20, expiringSoon: true, expiredNotClosed: false, renewals: [] }] };
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-commitments'));
  expect(await screen.findByTestId('ret-P-001')).toHaveTextContent(/Release due — claim now/);
  await fireEvent.changeText(screen.getByTestId('ret-claim-P-001'), '10400');
  await fireEvent.changeText(screen.getByTestId('ret-ref-P-001'), 'GAT/RET/1');
  await fireEvent.press(screen.getByTestId('ret-claim-save-P-001'));
  await waitFor(() => expect(api.commitments.posts[0]).toMatchObject({ path: '/commitments/retention/p1/claims', body: { amount: 10400, reference: 'GAT/RET/1' } }));
  // Changing only the % keeps the project's DLP (24 months), handover date and base.
  await fireEvent.changeText(screen.getByTestId('ret-pct-P-001'), '3');
  await fireEvent.press(screen.getByTestId('ret-terms-P-001'));
  const terms = () => api.commitments.posts.find((x) => x.path === '/commitments/retention/p1/terms');
  await waitFor(() => expect(terms()).toMatchObject({ body: { dlpMonths: 24, retentionPct: 3, retentionBase: 'taxable' } }));
  expect(terms().body.handoverDate).toBeUndefined();
  await fireEvent.press(screen.getByText('Bank guarantees'));
  expect(await screen.findByTestId('bg-BG/0042')).toHaveTextContent(/Expires in 20 days/);
});
