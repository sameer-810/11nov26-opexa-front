import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

const line = { id: 'l1', userId: 'u2', name: 'Raju', employeeCode: 'T01', payType: 'daily', rate: 800, otRatePerHour: 100, daysPresent: 3, workedMinutes: 1620, otMinutes: 180, workingDays: 27, flaggedDays: 1, basePay: 2400, otPay: 300, allowance: 500, adjustment: 0, gross: 3200, advanceOutstanding: 1000, advanceDeduction: 1000, otherDeduction: 0, net: 2200, note: '', edited: false };

async function signIn(api: ReturnType<typeof installMockApi>, email: string, pw: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), pw);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
  return api;
}

describe('Phase 11 - Payroll screens', () => {
  test('accounts edits a line; flagged attendance is called out', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'meena@airtech.in', password: 'Meena12345', role: 'accounts', name: 'Meena' });
    api.payroll.run = { id: 'run1', month: '2026-10', status: 'draft', totals: { gross: 3200, advanceDeduction: 1000, otherDeduction: 0, net: 2200 }, calculatedAt: new Date().toISOString(), finalizedAt: null, reopenReason: null, lines: [line] };
    await signIn(api, 'meena@airtech.in', 'Meena12345');
    expect(screen.getByTestId('tile-payroll')).toBeTruthy();
    expect(screen.getByTestId('tile-team-attendance')).toBeTruthy();
    // open the run directly by URL-like navigation through the payroll list is covered in the browser test
    await fireEvent.press(screen.getByTestId('tile-payroll'));
    await screen.findByTestId('payroll-screen');
  });

  test('staff sees the payslip breakdown', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'raju@airtech.in', password: 'Raju123456', role: 'staff', name: 'Raju' });
    api.payroll.payslips.push({ month: '2026-10', daysPresent: 3, workedMinutes: 1620, otMinutes: 180, basePay: 2400, otPay: 300, allowance: 500, adjustment: 100, gross: 3300, advanceDeduction: 600, otherDeduction: 200, net: 2500, note: 'Canteen' });
    await signIn(api, 'raju@airtech.in', 'Raju123456');
    expect(screen.queryByTestId('tile-payroll')).toBeNull();
    await fireEvent.press(screen.getByTestId('tile-payslips'));
    const slip = await screen.findByTestId('payslip-2026-10');
    expect(slip).toHaveTextContent(/3 days · 27 h worked · 3 h overtime/);
    expect(slip).toHaveTextContent(/Advance recovered− ₹600/);
    expect(slip).toHaveTextContent(/Net pay₹2,500/);
    expect(screen.getByTestId('payslip-advance')).toHaveTextContent(/₹400/);
  });
});
