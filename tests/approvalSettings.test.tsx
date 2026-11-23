import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installApprovalMock } from './helpers/mockApprovalApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'admin@airtech.in', password: 'Admin12345', role: 'admin', name: 'Asha', permissions: ['team.manage', 'settings.manage', 'approval.manage', 'attendance.self'] });
  const ap = installApprovalMock(api);
  ap.people.push({ id: 'u9', name: 'Meera', role: 'hod', canApprove: true });
  return { api, ap };
}

async function openSettings(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-approvals'));
  await fireEvent.press(await screen.findByTestId('open-approval-settings'));
  await screen.findByTestId('approval-settings-screen');
}

describe('1F.1 - Approval settings screen', () => {
  test('shows the default chain, creates a purchase order workflow with a role level and a person level', async () => {
    const { ap } = setup();
    await openSettings('admin@airtech.in', 'Admin12345');
    expect(await screen.findByTestId('workflow-levels-wlow')).toHaveTextContent('Purchaser → Project Manager');
    expect(screen.getByTestId('workflow-levels-whigh')).toHaveTextContent('Purchaser → Project Manager → Director');
    expect(screen.queryByTestId('toggle-workflow-wlow')).toBeNull();
    // The low row reads as the band below the high row's threshold, not "Any amount".
    expect(screen.getByTestId('workflow-wlow')).toHaveTextContent(/Below ₹1,00,000/);
    expect(screen.getByTestId('workflow-whigh')).toHaveTextContent(/₹1,00,000\.00 and above/);

    await fireEvent.press(screen.getByTestId('new-workflow'));
    await fireEvent.press(screen.getByTestId('wf-save'));
    expect(screen.getByTestId('wf-error')).toHaveTextContent(/name/);
    await fireEvent.changeText(screen.getByTestId('wf-name'), 'Big POs');
    await fireEvent.press(screen.getByTestId('wf-type-purchase_order'));
    await fireEvent.changeText(screen.getByTestId('wf-min'), '500000');
    await fireEvent.press(screen.getByTestId('wf-level-1-role-hod'));
    await fireEvent.press(screen.getByTestId('wf-add-level'));
    await fireEvent.press(screen.getByTestId('wf-level-2-by-user'));
    await fireEvent.press(screen.getByTestId('wf-level-2-user-u9'));
    await fireEvent.press(screen.getByTestId('wf-save'));

    await waitFor(() => expect(ap.sent.find((s) => s.path === '/approvals/workflows')).toBeTruthy());
    expect(ap.sent.find((s) => s.path === '/approvals/workflows')?.body).toEqual({
      name: 'Big POs', transactionType: 'purchase_order', projectId: null, departmentId: null, minAmount: 500000, maxAmount: null, isActive: true,
      levels: [{ sequence: 1, approverRole: 'hod' }, { sequence: 2, approverUserId: 'u9' }],
    });
    expect(await screen.findByText('Big POs')).toBeTruthy();
  });

  test('switches a workflow off, restores the default chain, and adds a department', async () => {
    const { ap } = setup();
    ap.workflows.push({ id: 'w7', name: 'Transfers', transactionType: 'transfer', projectId: null, departmentId: null, department: null, minAmount: 0, maxAmount: null, isActive: true, isDefault: false, defaultKey: null, version: 1, levels: [{ sequence: 1, approverRole: 'hod', approverUserId: null }] });
    ap.workflows[0].levels = [{ sequence: 1, approverRole: 'hod' }];
    await openSettings('admin@airtech.in', 'Admin12345');

    await fireEvent.press(await screen.findByTestId('toggle-workflow-w7'));
    await waitFor(() => expect(ap.sent.some((s) => s.path === '/approvals/workflows/w7')).toBe(true));
    expect(ap.sent.find((s) => s.path === '/approvals/workflows/w7')?.body).toMatchObject({ isActive: false, levels: [{ sequence: 1, approverRole: 'hod' }] });

    expect(screen.getByTestId('workflow-levels-wlow')).toHaveTextContent('Head of Department');
    await fireEvent.press(screen.getByTestId('restore-default'));
    await waitFor(() => expect(screen.getByTestId('workflow-levels-wlow')).toHaveTextContent('Purchaser → Project Manager'));

    await fireEvent.changeText(screen.getByTestId('department-name'), 'HVAC');
    await fireEvent.press(screen.getByTestId('department-add'));
    expect(await screen.findByTestId('department-HVA')).toHaveTextContent(/HVAC · HVA/);
    await fireEvent.press(screen.getByTestId('department-toggle-HVA'));
    await waitFor(() => expect(ap.departments[0].isActive).toBe(false));
  });

  test('a user without approval admin rights has no settings button', async () => {
    const { api } = setup();
    api.addUser({ email: 'hod@airtech.in', password: 'Hod12345', role: 'hod', name: 'Meera', permissions: ['approval.act', 'attendance.self'] });
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'hod@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Hod12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await fireEvent.press(await screen.findByTestId('tile-approvals'));
    await screen.findByTestId('approvals-screen');
    expect(screen.queryByTestId('open-approval-settings')).toBeNull();
    expect(screen.getByTestId('open-delegations')).toBeTruthy();
  });
});
