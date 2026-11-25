import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { kvStore } from '../src/shared/offline/kvStore';

const owner = {
  companyName: 'Global Airtech',
  name: 'Ehtesham Salik',
  email: 'owner@globalairtech.in',
  phone: '9876543210',
  password: 'Airtech2026',
};

async function signInAsOwner() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), owner.email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), owner.password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
}

describe('Sign-up is closed (accounts are created by the company admin)', () => {
  test('landing and sign-in offer only "Sign in", and the old /signup address is not a screen', async () => {
    installMockApi();
    const ref = await renderApp();
    await screen.findByTestId('landing-screen');
    expect(screen.queryByTestId('hero-signup')).toBeNull();
    expect(screen.queryByTestId('header-signup')).toBeNull();
    await fireEvent.press(screen.getByTestId('hero-signin'));
    expect(await screen.findByTestId('signin-ask-admin')).toHaveTextContent(/Ask your company admin/);
    expect(screen.queryByTestId('goto-signup')).toBeNull();
    expect(ref.getRootState()?.routeNames).not.toContain('SignUp');
  });
});

describe('Phase 1 - Sign in and sign out', () => {
  test('wrong password shows an error and stays on sign in', async () => {
    installMockApi().addUser(owner);
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), owner.email);
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Wrong12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('signin-error')).toHaveTextContent('Email or password is incorrect');
    expect(screen.queryByTestId('dashboard-screen')).toBeNull();
  });

  test('correct details sign in; sign out returns to sign in and clears the saved session', async () => {
    installMockApi().addUser(owner);
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), owner.email);
    await fireEvent.changeText(screen.getByTestId('signin-password'), owner.password);
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('signout'));
    expect(await screen.findByTestId('signin-screen')).toBeTruthy();
    expect(await kvStore.get('opexa.refreshToken')).toBeNull();
  });

  test('a saved session is restored on app start (stays signed in after reload)', async () => {
    installMockApi().addUser(owner);
    await signInAsOwner();
    await screen.findByTestId('dashboard-screen');
    await cleanup();

    await renderApp();
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
  });

  test('an expired saved session falls back to the signed-out flow', async () => {
    installMockApi();
    await kvStore.set('opexa.refreshToken', 'stale-token-xxxxxxxxxxxxxxxxxxxx');
    await renderApp();
    expect(await screen.findByTestId('landing-screen')).toBeTruthy();
    await waitFor(async () => expect(await kvStore.get('opexa.refreshToken')).toBeNull());
  });
});
