import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { receivingApi } from '../../receiving/api/receivingApi';
import { LOT_LABEL, LOT_TONE, type Lot } from '../../receiving/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectLots'>;

// Every delivery (lot) to this site; tap one to check it in.
export function ProjectLotsScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setLots(await receivingApi.lots(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const pending = lots?.filter((l) => l.status === 'in-transit').length ?? 0;
  const shown = (lots ?? []).filter((l) => filter === 'all' || (filter === 'pending' ? l.status === 'in-transit' : l.status !== 'in-transit')).slice().reverse();

  return (
    <AppScreen title="Deliveries (lots)" subtitle={pending ? `${pending} on the way - check them in when they arrive` : 'Every delivery sent to this site'} onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-lots-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!lots && !error ? <ActivityIndicator /> : null}
      {lots && lots.length > 0 ? (
        <ChoiceChips label="Show" value={filter} onChange={setFilter} testID="lots-filter" options={[{ value: 'all', label: 'All' }, { value: 'pending', label: `On the way (${pending})` }, { value: 'done', label: 'Checked in' }]} />
      ) : null}
      {lots && lots.length === 0 ? <EmptyState title="No deliveries yet" /> : null}
      <View style={styles.list}>
        {shown.map((l) => (
          <Pressable key={l.id} onPress={() => navigation.navigate('LotDetail', { projectId: id, lotId: l.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`project-lot-${l.lotNo}`}>
            <View style={styles.top}>
              <Text style={styles.title}>Lot {l.lotNo} · {l.vendorName}</Text>
              <StatusChip label={LOT_LABEL[l.status]} tone={LOT_TONE[l.status]} testID={`lot-status-${l.lotNo}`} />
            </View>
            <Text style={styles.muted}>
              Challan {l.challanNo} · {l.poNumber} · sent {formatDate(l.dispatchDate)}
              {l.status === 'in-transit' && (l.daysInTransit ?? 0) > 2 ? ` · ${l.daysInTransit} days, not checked in` : ''}
            </Text>
            {l.lines.map((x) => (
              <Text key={x.id} style={styles.line}>
                {x.serialNo}. {x.description}: {formatNumber(x.qty)} {x.unit}
                {x.qtyShort ? ` (short ${formatNumber(x.qtyShort)})` : ''}
                {x.qtyDamaged ? ` (damaged ${formatNumber(x.qtyDamaged)})` : ''}
              </Text>
            ))}
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  line: { fontSize: 14, color: colors.text },
});
