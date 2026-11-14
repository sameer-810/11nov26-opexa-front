import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { serviceApi, STATUS_LABEL, STATUS_TONE, type Ticket } from '../api/serviceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Service'>;
const FILTERS = [{ value: 'active', label: 'Open jobs' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }, { value: '', label: 'All' }];

export function ServiceScreen({ navigation }: Props) {
  const { user } = useAuth();
  const manager = can(user, PERMS.SERVICE_MANAGE);
  const [filter, setFilter] = useState('active');
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await serviceApi.tickets({ status: filter }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [filter]);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <AppScreen
      title={manager ? 'Service & warranty' : 'My service jobs'}
      subtitle={manager ? 'Complaints, technician visits and preventive maintenance' : 'Jobs given to you'}
      onBack={() => navigation.navigate('Dashboard')}
      testID="service-screen"
    >
      {manager ? (
        <View style={styles.row}>
          <Button title="New complaint" onPress={() => navigation.navigate('NewTicket')} testID="svc-new" />
          <Button title="Equipment & warranty" variant="outline" onPress={() => navigation.navigate('ServiceAssets')} testID="svc-assets" />
        </View>
      ) : null}
      <ChoiceChips label="Show" options={FILTERS} value={filter} onChange={(v) => { setRows(null); setFilter(v); }} testID="svc-filter" />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && !rows.length ? <EmptyState title="Nothing here" body={filter === 'active' ? 'No open service jobs.' : undefined} /> : null}
      {rows?.map((t) => (
        <Pressable key={t.id} style={styles.card} onPress={() => navigation.navigate('TicketDetail', { id: t.id })} testID={`svc-row-${t.number}`}>
          <View style={styles.row}>
            <Text style={styles.num}>{t.number}</Text>
            <StatusChip label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
            {t.priority === 'urgent' ? <StatusChip label="Urgent" tone="danger" /> : null}
            {t.kind === 'preventive' ? <StatusChip label="Preventive" tone="info" /> : null}
            {t.asset ? <StatusChip label={t.underWarranty ? 'In warranty' : 'Chargeable'} tone={t.underWarranty ? 'success' : 'warning'} /> : null}
          </View>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.muted}>
            {t.project.name}{t.asset ? ` · ${[t.asset.location, t.asset.name, t.asset.serialNo].filter(Boolean).join(' · ')}` : ''} · {formatDate(t.createdAt)}
            {t.assignedTo ? ` · ${t.assignedTo.name}` : manager ? ' · not assigned' : ''}
          </Text>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  num: { fontSize: 14, fontWeight: '800', color: colors.text },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
