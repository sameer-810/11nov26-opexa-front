import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { onPushTap } from '../shared/push/push';
import { OfflineSync } from '../shared/offline/OfflineSync';
import { routeForLink } from './routeForLink';
import type { RootStackParamList } from './types';
import { useAuth } from '../shared/store/useAuthStore';
import { RootNavigator, navMode } from './RootNavigator';
import { linking } from './linking';

// Waits until the saved session has been checked before reading the URL,
// so links like /app open the right screen after a page reload.
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const { status, isSignedIn, user } = useAuth();
  const pendingLink = useRef<string | null>(null);

  // Tapping a phone notification opens the screen it is about.
  const go = (link: string | null) => {
    const target = routeForLink(link, user);
    if (!target) return;
    if (navigationRef.isReady()) (navigationRef.navigate as (name: string, params?: object) => void)(target.name, target.params);
    else pendingLink.current = link;
  };
  useEffect(() => (isSignedIn ? onPushTap(go) : undefined), [isSignedIn, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="app-loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const link = pendingLink.current;
        pendingLink.current = null;
        if (link) go(link);
      }}
      key={navMode(isSignedIn, user?.mustChangePassword)}
      linking={linking} documentTitle={{ formatter: (options) => options?.title ?? 'Opexa' }}>
      {isSignedIn ? <OfflineSync /> : null}
      <RootNavigator />
    </NavigationContainer>
  );
}
