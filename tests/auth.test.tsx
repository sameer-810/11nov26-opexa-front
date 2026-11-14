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

async function fillSignUp(values = owner, confirm = owner.password) {
  await fireEvent.changeText(screen.getByTestId('signup-company'), values.companyName);
  await fireEvent.changeText(screen.getByTestId('signup-name'), values.name);
  await fireEvent.changeText(screen.getByTestId('signup-email'), values.email);
  await fireEvent.changeText(screen.getByTestId('signup-phone'), values.phone);
  await fireEvent.changeText(screen.getByTestId('signup-password'), values.password);
  await fireEvent.changeText(screen.getByTestId('signup-confirm'), confirm);
}

async function openSignUp() {
  await renderApp();
  await fireEvent.press(await screen.findByTestId('hero-signup'));
  await screen.findByTestId('signup-screen');
}

describe('Phase 1 - Sign up', () => {
  test('creates the company and opens the dashboard', async () => {
    installMockApi();
    await openSignUp();
    await fillSignUp();
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
    expect(screen.getByTestId('dashboard-company')).toHaveTextContent('Global Airtech');
    expect(screen.getByTestId('dashboard-welcome')).toHaveTextContent('Welcome, Ehtesham');
    expect(await kvStore.get('opexa.refreshToken')).toBeTruthy();
  });

  test('shows field errors and does not call the API when the form is invalid', async () => {
    const { fetchMock } = installMockApi();
    await openSignUp();
    await fillSignUp({ ...owner, email: 'bad', password: 'short' }, 'different');
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(screen.getByTestId('signup-email-error')).toHaveTextContent('Enter a valid email address');
    expect(screen.getByTestId('signup-password-error')).toHaveTextContent(/at least 8 characters/);
    expect(screen.getByTestId('signup-confirm-error')).toHaveTextContent('Passwords do not match');
    const signupCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/signup'));
    expect(signupCalls).toHaveLength(0);
  });

  test('shows the server error when the email is already registered', async () => {
    const mock = installMockApi();
    mock.addUser(owner);
    await openSignUp();
    await fillSignUp();
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-error')).toHaveTextContent(/already exists/);
    expect(screen.getByTestId('signup-email-error')).toHaveTextContent('Already registered');
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
    installMockApi();
    await openSignUp();
    await fillSignUp();
    await fireEvent.press(screen.getByTestId('signup-submit'));
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
