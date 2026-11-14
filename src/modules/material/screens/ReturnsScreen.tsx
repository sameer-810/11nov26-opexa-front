import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import { canRecordAtSite } from '../../receiving/canRecord';
import { materialApi } from '../api/materialApi';
import { RETURN_STATUS_LABEL, RETURN_TONE, RETURN_TYPE_LABEL, type MaterialReturn } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Returns' | 'ProjectReturns'>;

// Used two ways: all returns (managers/buyers confirm them here) or one project's returns.
export function ReturnsScreen({ navigation, route }: Props) {
  const projectId = route.name === 'ProjectReturns' ? (route.params as { id: string }).id : undefined;
  const { user } = useAuth();
  const [rows, setRows] = useState<MaterialReturn[] | null>(null);
  const [filter, setFilter] = useState(projectId ? 'all' : 'pending');
  const [mayAdd, setMayAdd] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await materialApi.returns(projectId));
      if (projectId) {
        const p = await projectApi.get(projectId);
        setMayAdd(p.status !== 'closed' && canRecordAtSite(user, p.memberIds));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [projectId, user]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const pending = rows?.filter((r) => r.status === 'pending').length ?? 0;
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  return (
    <AppScreen
      title={projectId ? 'Returns & transfers' : 'Returns to confirm'}
      subtitle={projectId ? 'Material sent back to store, to a vendor, or to another site' : 'Confirm when returned material reaches the store, vendor or other site'}
      onBack={() => (projectId ? navigation.navigate('ProjectDetail', { id: projectId }) : navigation.navigate('Dashboard'))}
      testID="returns-screen"
    >
      {mayAdd && projectId ? <Button title="Send material back" onPress={() => navigation.navigate('NewReturn', { id: projectId })} testID="return-new" style={styles.self} /> : null}
      <ChoiceChips label="Show" value={filter} onChange={setFilter} testID="returns-filter" options={[{ value: 'pending', label: `Waiting (${pending})` }, { value: 'accepted', label: 'Confirmed' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && shown.length === 0 ? <EmptyState title={filter === 'pending' ? 'Nothing waiting' : 'No returns'} /> : null}
      <View style={styles.list}>
        {shown.map((r) => (
          <Pressable key={r.id} onPress={() => navigation.navigate('ReturnDetail', { id: r.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`return-${r.number}`}>
            <View style={styles.top}>
              <Text style={styles.title}>{r.number} · {RETURN_TYPE_LABEL[r.type]}</Text>
              <StatusChip label={RETURN_STATUS_LABEL[r.status]} tone={RETURN_TONE[r.status]} />
            </View>
            <Text style={styles.muted}>
              From {r.projectName}{r.toProject ? ` to ${r.toProject.name}` : ''}{r.vendor ? ` to ${r.vendor.name}` : ''} · {formatDate(r.createdAt)} · by {r.createdBy?.name ?? '—'}
            </Text>
            <Text style={styles.line}>{r.lines.map((l) => `${l.serialNo}. ${l.description}: ${formatNumber(l.qty)} ${l.unit}`).join(' · ')}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  line: { fontSize: 14, color: colors.text },
});
