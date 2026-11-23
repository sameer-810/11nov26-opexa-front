import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installExpenseMock } from './helpers/mockExpenseApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.addUser({ email: 'meena@airtech.in', password: 'Meena12345', role: 'accounts', name: 'Meena' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  return { api, exp: installExpenseMock(api) };
}

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

describe('1G - Expense vouchers', () => {
  test('employee fills the form, is told to attach the receipt, takes a photo and submits for approval', async () => {
    const { exp } = setup();
    await signIn('ravi@airtech.in', 'Ravi12345');
    await fireEvent.press(await screen.findByTestId('tile-expenses'));
    expect(screen.queryByTestId('open-expenses-to-pay')).toBeNull(); // not accounts
    await fireEvent.press(await screen.findByTestId('exp-new'));

    await fireEvent.press(await screen.findByTestId('exp-submit'));
    expect(screen.getByTestId('exp-error')).toHaveTextContent('Choose a category');
    await fireEvent.press(screen.getByTestId('exp-category-c1'));
    await fireEvent.changeText(screen.getByTestId('exp-amount'), '1,250');
    await fireEvent.press(screen.getByTestId('exp-project-p1'));
    await fireEvent.changeText(screen.getByTestId('exp-note'), 'Train to Worli site');
    await fireEvent.press(screen.getByTestId('exp-submit'));
    expect(screen.getByTestId('exp-error')).toHaveTextContent(/Attach the receipt/);
    expect(exp.vouchers).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('exp-camera'));
    expect(await screen.findByText(/to upload/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('exp-submit'));

    expect(await screen.findByTestId('my-expenses-screen')).toBeTruthy();
    expect(await screen.findByTestId('exp-EXP-0001')).toHaveTextContent(/Waiting for approval/);
    expect(exp.vouchers[0]).toMatchObject({ number: 'EXP-0001', status: 'submitted', amount: 1250, projectId: 'p1', category: 'Travel', note: 'Train to Worli site' });
    expect(exp.vouchers[0].attachments).toHaveLength(1);
  });

  test('a sent-back voucher shows the approver comment and is resubmitted after editing', async () => {
    const { exp } = setup();
    exp.vouchers.push({ id: 'e9', number: 'EXP-0009', status: 'sent_back', direct: false, date: '2026-11-20', amount: 900, category: 'Conveyance', categoryId: 'c2', note: 'Auto', billNo: '', projectId: null, projectName: null, projectCode: null, employee: { id: 'u2', name: 'Ravi Kumar' }, attachments: [], reviewComment: 'Amount is 700', approvalRequestId: 'r1', submittedAt: null, payment: null, voided: null, createdAt: '2026-11-20T10:00:00Z' });
    await signIn('ravi@airtech.in', 'Ravi12345');
    await fireEvent.press(await screen.findByTestId('tile-expenses'));
    expect(await screen.findByTestId('exp-EXP-0009')).toHaveTextContent(/Sent back: Amount is 700/);
    await fireEvent.press(screen.getByTestId('exp-EXP-0009'));
    expect(await screen.findByTestId('exp-review-comment')).toHaveTextContent('Approver: Amount is 700');
    expect(screen.queryByTestId('exp-discard')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('exp-amount'), '700');
    await fireEvent.press(screen.getByTestId('exp-submit')); // no receipt needed for Conveyance
    await screen.findByTestId('my-expenses-screen');
    await waitFor(() => expect(exp.vouchers[0]).toMatchObject({ status: 'submitted', amount: 700 }));
  });

  test('accounts mark an approved voucher paid; bank transfer needs a reference', async () => {
    const { exp } = setup();
    exp.vouchers.push({ id: 'e1', number: 'EXP-0001', status: 'approved', direct: false, date: '2026-11-20', amount: 1250, category: 'Travel', categoryId: 'c1', note: 'Train', billNo: '', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', employee: { id: 'u2', name: 'Ravi Kumar' }, attachments: [{ id: 'a1', name: 'ticket.pdf', contentType: 'application/pdf', size: 4096 }], reviewComment: '', approvalRequestId: 'r1', submittedAt: null, payment: null, voided: null, createdAt: '2026-11-20T10:00:00Z' });
    await signIn('meena@airtech.in', 'Meena12345');
    await fireEvent.press(await screen.findByTestId('tile-expenses'));
    await fireEvent.press(await screen.findByTestId('open-expenses-to-pay'));
    expect(await screen.findByTestId('pay-EXP-0001')).toHaveTextContent(/Ravi Kumar · Travel/);
    expect(screen.getByText(/ticket\.pdf/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pay-submit-EXP-0001'));
    expect(await screen.findByTestId('pay-problem')).toHaveTextContent('Enter the bank / UPI reference');
    await fireEvent.press(screen.getByTestId('pay-mode-EXP-0001-upi'));
    await fireEvent.changeText(screen.getByTestId('pay-ref-EXP-0001'), 'UPI-5521');
    await fireEvent.changeText(screen.getByTestId('pay-date-EXP-0001'), '2026-11-22');
    await fireEvent.press(screen.getByTestId('pay-submit-EXP-0001'));
    await waitFor(() => expect(exp.vouchers[0]).toMatchObject({ status: 'paid', payment: { mode: 'upi', reference: 'UPI-5521', paidDate: '2026-11-22' } }));
    expect(await screen.findByText('Nothing waiting for payment')).toBeTruthy();
  });
});
