import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../../src/shared/store/useAuthStore';
import { RootNavigator, navMode } from '../../src/navigation/RootNavigator';
import type { RootStackParamList } from '../../src/navigation/types';

export async function renderApp({ showLanding = true } = {}) {
  const ref = createNavigationContainerRef<RootStackParamList>();
  function Shell() {
    const { status, isSignedIn, user } = useAuth();
    if (status === 'loading') return null;
    return (
      <NavigationContainer key={navMode(isSignedIn, user?.mustChangePassword)} ref={ref}>
        <RootNavigator showLanding={showLanding} />
      </NavigationContainer>
    );
  }
  await render(
    <AuthProvider>
      <Shell />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.toJSON()).not.toBeNull());
  return ref;
}
