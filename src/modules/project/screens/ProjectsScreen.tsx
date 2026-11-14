import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../api/projectApi';
import { STATUS_LABEL, type Project } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

export function ProjectsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const manage = can(user, PERMS.PROJECT_MANAGE);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setProjects(await projectApi.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load projects');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <AppScreen
      title="Projects"
      subtitle={manage ? 'All company projects' : 'Projects you are assigned to'}
      onBack={() => navigation.navigate('Dashboard')}
      right={manage ? <Button title="New project" onPress={() => navigation.navigate('NewProject')} testID="new-project" /> : null}
      testID="projects-screen"
    >
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!projects && !error ? <ActivityIndicator /> : null}
      {projects && projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body={manage ? 'Create a project and load its client work order (BOQ).' : 'You have not been assigned to a project yet.'}
        />
      ) : null}
      <View style={styles.list}>
        {projects?.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => navigation.navigate('ProjectDetail', { id: p.id })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            testID={`project-${p.code}`}
          >
            <View style={styles.top}>
              <Text style={styles.code}>{p.code}</Text>
              <StatusChip label={STATUS_LABEL[p.status]} tone={p.status === 'active' ? 'success' : p.status === 'closing' ? 'warning' : 'neutral'} />
            </View>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.muted}>{p.clientName}{p.siteAddress ? ` · ${p.siteAddress}` : ''}</Text>
            <Text style={styles.meta}>
              {p.boqItemCount} BOQ item{p.boqItemCount === 1 ? '' : 's'} · {formatMoney(p.boqValue)} · {p.memberIds.length} in team
            </Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexGrow: 1, flexBasis: 320, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 13, fontWeight: '700', color: colors.primary },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
