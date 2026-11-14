import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDateTime } from '../../../shared/format';
import { useAuth } from '../../../shared/store/useAuthStore';
import { routeForLink } from '../../../navigation/routeForLink';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { notificationApi, type AppNotification } from '../api/notificationApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await notificationApi.list()).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const open = async (n: AppNotification) => {
    if (!n.read) notificationApi.read(n.id).catch(() => undefined);
    const target = routeForLink(n.link, user);
    if (target) (navigation.navigate as (name: string, params?: object) => void)(target.name, target.params);
    else load();
  };

  const readAll = async () => {
    await notificationApi.readAll().catch(() => undefined);
    load();
  };

  return (
    <AppScreen
      title="Notifications"
      onBack={() => navigation.navigate('Dashboard')}
      right={items?.some((i) => !i.read) ? <Button title="Mark all read" variant="ghost" onPress={readAll} testID="read-all" /> : null}
      testID="notifications-screen"
    >
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <ActivityIndicator /> : null}
      {items && items.length === 0 ? <EmptyState title="No notifications yet" /> : null}
      <View style={styles.list}>
        {items?.map((n) => (
          <Pressable key={n.id} onPress={() => open(n)} style={({ pressed }) => [styles.card, !n.read && styles.unread, pressed && styles.pressed]} testID={`notif-${n.type}`}>
            <View style={styles.top}>
              <Text style={[styles.title, !n.read && styles.bold]}>{n.title}</Text>
              {!n.read ? <View style={styles.dot} /> : null}
            </View>
            {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
            <Text style={styles.time}>{formatDateTime(n.createdAt)}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  unread: { borderColor: colors.primary, backgroundColor: '#F8FAFF' },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 15, color: colors.text, flexShrink: 1 },
  bold: { fontWeight: '700' },
  body: { fontSize: 14, color: colors.textMuted },
  time: { fontSize: 12, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
