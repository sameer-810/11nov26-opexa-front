import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { receivingApi } from '../api/receivingApi';
import type { MaterialStatus } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MaterialStatus'>;

const COLS = [
  ['S.No', 50], ['Item', 220], ['BOQ', 70], ['Requested', 90], ['Not ordered', 90], ['Awaiting dispatch', 100],
  ['On the way', 90], ['Received', 80], ['Local buy', 80], ['Transfer in', 80], ['Returned', 80], ['Installed', 80], ['At site', 80], ['Damaged', 80], ['Pending', 80], ['BOQ left', 80],
] as const;

export function MaterialStatusScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [data, setData] = useState<MaterialStatus | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await receivingApi.material(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const s = data?.summary;
  return (
    <AppScreen title="Material status" subtitle={data ? `${data.projectName}: what was asked for, where it is, what is pending` : undefined} onBack={() => navigation.navigate('ProjectDetail', { id })} testID="material-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {s ? (
        <View style={styles.tiles}>
          <Tile label="Items pending" value={s.itemsPending} warn={s.itemsPending > 0} testID="ms-pending" />
          <Tile label="Lots on the way" value={s.lotsInTransit} testID="ms-transit" />
          <Tile label="Lots late (2+ days)" value={s.lotsOverdue} warn={s.lotsOverdue > 0} testID="ms-overdue" />
          <Tile label="Items over BOQ" value={s.itemsOverBoq} warn={s.itemsOverBoq > 0} testID="ms-over" />
        </View>
      ) : null}
      {s && s.lotsInTransit > 0 ? <Button title="Check in deliveries" variant="outline" onPress={() => navigation.navigate('ProjectLots', { id })} testID="ms-lots" style={styles.self} /> : null}
      {data && data.items.length === 0 ? <EmptyState title="No BOQ items yet" /> : null}
      {data && data.items.length > 0 ? (
        <ScrollView horizontal>
          <View>
            <View style={[styles.tr, styles.head]}>
              {COLS.map(([h, w]) => <Text key={h} style={[styles.th, { width: w }]}>{h}</Text>)}
            </View>
            {data.items.map((r) => {
              const vals = [r.serialNo, r.description, r.boqQty, r.requested, r.notOrdered, r.awaitingDispatch, r.inTransit, r.received, r.localPurchased, r.transferredIn, r.returned, r.installed, r.atSite, r.damaged, r.pending, r.boqBalance];
              return (
                <View key={r.workOrderItemId} style={styles.tr} testID={`ms-row-${r.serialNo}`}>
                  {vals.map((v, i) => (
                    <Text key={COLS[i][0]} style={[styles.td, { width: COLS[i][1] }, i > 1 && styles.num, i === 14 && r.pending > 0 && styles.warn, i === 15 && r.boqBalance < 0 && styles.danger]}>
                      {typeof v === 'number' ? formatNumber(v) : v}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
      <Text style={styles.muted}>Pending = requested minus good quantity received. At site = received + local buy + transfer in - returned - installed. BOQ left = BOQ minus (net supplied).</Text>
    </AppScreen>
  );
}

function Tile({ label, value, warn, testID }: { label: string; value: number; warn?: boolean; testID: string }) {
  return (
    <View style={[styles.tile, warn && styles.tileWarn]} testID={testID}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, minWidth: 150, gap: 2 },
  tileWarn: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  tileValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  td: { padding: 8, fontSize: 14, color: colors.text },
  num: { textAlign: 'right' },
  warn: { color: '#B45309', fontWeight: '700' },
  danger: { color: colors.danger, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted },
  self: { alignSelf: 'flex-start' },
});
