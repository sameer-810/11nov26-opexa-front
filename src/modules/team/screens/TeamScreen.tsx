import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { teamApi } from '../api/teamApi';
import { ROLE_LABEL, type TeamMember } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Team'>;

export function TeamScreen({ navigation }: Props) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setMembers(await teamApi.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the team');
    }
  }, []);

  // Reload whenever the screen is shown (e.g. after adding or editing someone).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <AppScreen
      title="Team"
      subtitle="People who can sign in to your company account"
      onBack={() => navigation.navigate('Dashboard')}
      right={<Button title="Add member" onPress={() => navigation.navigate('AddMember')} testID="add-member" />}
      testID="team-screen"
    >
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!members && !error ? <ActivityIndicator /> : null}
      {members && members.length <= 1 ? (
        <EmptyState title="Only you so far" body="Add your purchaser, engineers and supervisors so they can use the app." />
      ) : null}
      <View style={styles.list}>
        {members?.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => navigation.navigate('MemberDetail', { id: m.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            testID={`member-${m.email}`}
          >
            <View style={styles.info}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.muted}>{m.email}</Text>
            </View>
            <View style={styles.chips}>
              <StatusChip label={ROLE_LABEL[m.role]} tone={m.role === 'owner' ? 'info' : 'neutral'} />
              {!m.isActive ? <StatusChip label="Deactivated" tone="danger" testID={`inactive-${m.email}`} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    flexWrap: 'wrap',
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  info: { flexShrink: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  chips: { flexDirection: 'row', gap: spacing.sm },
});
