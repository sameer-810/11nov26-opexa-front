import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

async function signInAs(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
}

describe('Phase 2 - Team management (owner)', () => {
  test('owner adds an engineer; they appear in the team list', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345', name: 'Ehtesham Salik' });
    await signInAs('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('tile-team'));
    await fireEvent.press(await screen.findByTestId('add-member'));
    await screen.findByTestId('add-member-screen');

    await fireEvent.press(screen.getByTestId('member-submit'));
    expect(screen.getByTestId('member-role-error')).toHaveTextContent('Choose a role');

    await fireEvent.changeText(screen.getByTestId('member-name'), 'Ravi Kumar');
    await fireEvent.changeText(screen.getByTestId('member-email'), 'ravi@airtech.in');
    await fireEvent.changeText(screen.getByTestId('member-phone'), '9000000001');
    await fireEvent.press(screen.getByTestId('member-role-engineer'));
    await fireEvent.changeText(screen.getByTestId('member-password'), 'Temp12345');
    await fireEvent.press(screen.getByTestId('member-submit'));

    expect(await screen.findByTestId('member-detail-screen')).toBeTruthy();
    expect(await screen.findByTestId('member-message')).toHaveTextContent(/Temp12345/);
    expect(api.byEmail('ravi@airtech.in')?.role).toBe('engineer');

    await fireEvent.press(screen.getByTestId('back'));
    expect(await screen.findByTestId('member-ravi@airtech.in')).toBeTruthy();
  });

  test('owner switches a permission on and saves', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Temp12345', role: 'engineer', name: 'Ravi' });
    await signInAs('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('tile-team'));
    await fireEvent.press(await screen.findByTestId('member-ravi@airtech.in'));
    await screen.findByTestId('permission-editor');
    await fireEvent(screen.getByTestId('perm-reports.view'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('save-member'));
    expect(await screen.findByTestId('member-message')).toHaveTextContent('Changes saved');
    expect(eng.permissions).toContain('reports.view');
  });

  test('deactivate asks for confirmation, then marks the member deactivated', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Temp12345', role: 'engineer', name: 'Ravi' });
    await signInAs('owner@airtech.in', 'Owner12345');
    await fireEvent.press(await screen.findByTestId('tile-team'));
    await fireEvent.press(await screen.findByTestId('member-ravi@airtech.in'));
    await fireEvent.press(await screen.findByTestId('deactivate'));
    expect(eng.isActive).toBe(true);
    await fireEvent.press(screen.getByTestId('confirm-deactivate'));
    await waitFor(() => expect(screen.getByTestId('member-status')).toHaveTextContent('Deactivated'));
    expect(eng.isActive).toBe(false);
  });
});

describe('Phase 2 - Access by role', () => {
  test('an engineer does not see the Team tile', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
    await signInAs('ravi@airtech.in', 'Ravi12345');
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
    expect(screen.getByTestId('dashboard-user')).toHaveTextContent(/Project Engineer/);
    expect(screen.queryByTestId('tile-team')).toBeNull();
  });

  test('a new member must replace the temporary password before using the app', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'ravi@airtech.in', password: 'Temp12345', role: 'engineer', name: 'Ravi Kumar', mustChangePassword: true });
    await signInAs('ravi@airtech.in', 'Temp12345');
    expect(await screen.findByTestId('change-password-screen')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-screen')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('cp-current'), 'wrong');
    await fireEvent.changeText(screen.getByTestId('cp-new'), 'Ravi12345');
    await fireEvent.changeText(screen.getByTestId('cp-confirm'), 'Ravi12345');
    await fireEvent.press(screen.getByTestId('cp-submit'));
    expect(await screen.findByTestId('change-password-error')).toHaveTextContent('Current password is incorrect');

    await fireEvent.changeText(screen.getByTestId('cp-current'), 'Temp12345');
    await fireEvent.press(screen.getByTestId('cp-submit'));
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
    expect(api.byEmail('ravi@airtech.in')?.password).toBe('Ravi12345');
  });
});
