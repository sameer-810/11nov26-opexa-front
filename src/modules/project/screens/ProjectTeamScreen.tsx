import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { ROLE_LABEL } from '../../team/types';
import type { Role } from '../../auth/types';
import { projectApi } from '../api/projectApi';
import type { AssignableUser } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectTeam'>;

export function ProjectTeamScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [users, setUsers] = useState<AssignableUser[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([projectApi.assignableUsers(), projectApi.get(id)])
      .then(([u, p]) => {
        setUsers(u.filter((x) => x.role !== 'owner'));
        setSelected(p.memberIds);
        setProjectName(p.name);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, [id]);

  const toggle = (uid: string) => setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await projectApi.setMembers(id, selected);
      navigation.navigate('ProjectDetail', { id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Project team" subtitle={projectName ? `Who works on ${projectName}` : undefined} onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-team-screen">
      {error ? <ErrorBanner message={error} /> : null}
      {!users ? <ActivityIndicator /> : null}
      {users && users.length === 0 ? <Text style={styles.muted}>Add team members first (Dashboard → Team).</Text> : null}
      <Text style={styles.muted}>Assigned people see this project and its BOQ. The owner and project managers see all projects.</Text>
      <View style={styles.list}>
        {users?.map((u) => {
          const on = selected.includes(u.id);
          return (
            <Pressable key={u.id} onPress={() => toggle(u.id)} style={[styles.row, on && styles.on]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`assign-${u.email}`}>
              <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
              <View style={styles.flex}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.muted}>{ROLE_LABEL[u.role as Role] ?? u.role} · {u.email}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Button title={`Save team (${selected.length})`} onPress={save} loading={busy} testID="save-project-team" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  on: { borderColor: colors.primary, backgroundColor: '#F8FAFF' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  flex: { flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  self: { alignSelf: 'flex-start' },
});
