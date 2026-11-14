import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDateTime } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../api/requisitionApi';
import type { Requisition } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Requisitions'>;

export function RequisitionsScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const overBoq = route.params?.overBoq === 'true' || (route.params?.overBoq as unknown) === true;
  const { user } = useAuth();
  const [rows, setRows] = useState<Requisition[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await requisitionApi.list({ projectId, overBoq }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load requests');
    }
  }, [projectId, overBoq]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const title = overBoq ? 'Over BOQ (PO amendment needed)' : 'Material requests';
  const subtitle = overBoq
    ? 'Requests that went beyond the client work order. Get the PO amended before billing.'
    : projectId && rows?.[0]
      ? `${rows[0].projectCode} · ${rows[0].projectName}`
      : projectId
        ? 'This project'
        : 'All projects you can see';

  return (
    <AppScreen
      title={title}
      subtitle={subtitle}
      onBack={() => (projectId ? navigation.navigate('ProjectDetail', { id: projectId }) : navigation.navigate('Dashboard'))}
      right={
        projectId && can(user, PERMS.REQUISITION_CREATE) ? (
          <Button title="New request" onPress={() => navigation.navigate('NewRequisition', { projectId })} testID="new-requisition" />
        ) : null
      }
      testID="requisitions-screen"
    >
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && rows.length === 0 ? <EmptyState title={overBoq ? 'Nothing over the BOQ' : 'No material requests yet'} /> : null}
      <View style={styles.list}>
        {rows?.map((r) => {
          const over = r.lines.filter((l) => l.overBy > 0);
          return (
            <Pressable key={r.id} onPress={() => navigation.navigate('RequisitionDetail', { id: r.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`req-${r.number}`}>
              <View style={styles.top}>
                <Text style={styles.number}>{r.number}</Text>
                <View style={styles.chips}>
                  {r.overBoq ? <StatusChip label="Over BOQ" tone="danger" /> : null}
                  <StatusChip label={r.status === 'open' ? 'Open' : 'Cancelled'} tone={r.status === 'open' ? 'info' : 'neutral'} />
                </View>
              </View>
              <Text style={styles.title}>{r.projectCode} · {r.projectName}</Text>
              <Text style={styles.muted}>{r.lines.length} item{r.lines.length === 1 ? '' : 's'} · {r.raisedBy.name} · {formatDateTime(r.createdAt)}</Text>
              {overBoq
                ? over.map((l) => (
                    <Text key={l.id} style={styles.overLine}>S.No {l.serialNo} {l.description}: +{l.overBy} {l.unit}. {l.overrideReason}</Text>
                  ))
                : null}
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm },
  number: { fontSize: 15, fontWeight: '800', color: colors.primary },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  overLine: { fontSize: 13, color: colors.danger },
});
