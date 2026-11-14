import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

beforeEach(() => installMockApi());

describe('Phase 0 - public flow (web)', () => {
  test('first page is the landing page', async () => {
    await renderApp();
    expect(await screen.findByTestId('landing-screen')).toBeTruthy();
    expect(screen.getByText('Run every HVAC site from one app')).toBeTruthy();
  });

  test('landing -> Sign in', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByTestId('header-signin'));
    expect(await screen.findByTestId('signin-screen')).toBeTruthy();
  });

  test('landing -> Sign up', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByTestId('hero-signup'));
    expect(await screen.findByTestId('signup-screen')).toBeTruthy();
  });

  test('protected /app redirects to sign in when signed out', async () => {
    const ref = await renderApp();
    await screen.findByTestId('landing-screen');
    ref.navigate('Dashboard');
    await waitFor(() => expect(ref.getCurrentRoute()?.name).toBe('SignIn'));
  });
});

describe('Phase 0 - mobile flow', () => {
  test('mobile app skips the landing page and opens on sign in', async () => {
    await renderApp({ showLanding: false });
    expect(await screen.findByTestId('signin-screen')).toBeTruthy();
    expect(screen.queryByTestId('landing-screen')).toBeNull();
  });
});
