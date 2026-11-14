import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ApiError } from '../../shared/api/apiClient';
import { formatMoney } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { ErrorState } from '../../shared/ui/ErrorState';
import { colors, spacing } from '../../shared/designSystem';
import { costingApi, type Cost } from './costingApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Costing'>;
const COLS = [['Project', 210], ['Contract', 100], ['Billed', 100], ['Material', 100], ['Labour', 90], ['Other', 80], ['Total cost', 100], ['Margin', 110], ['Loss items', 80]] as const;

export function CostingScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Cost[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await costingApi.summary());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <AppScreen title="Project costing" subtitle="What each project earned against what it cost" onBack={() => navigation.navigate('Dashboard')} testID="costing-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows ? (
        <ScrollView horizontal>
          <View>
            <View style={[styles.tr, styles.head]}>{COLS.map(([h, w]) => <Text key={h} style={[styles.th, { width: w }]}>{h}</Text>)}</View>
            {rows.map((r) => (
              <Pressable key={r.project.id} onPress={() => navigation.navigate('ProjectCost', { id: r.project.id })} style={styles.tr} testID={`cost-row-${r.project.code}`}>
                <Text style={[styles.td, { width: COLS[0][1] }]}>{r.project.code} {r.project.name}</Text>
                {[r.contractValue, r.billed, r.materialCost, r.labourCost, r.otherCost, r.totalCost].map((v, i) => <Text key={i} style={[styles.td, styles.num, { width: COLS[i + 1][1] }]}>{formatMoney(v)}</Text>)}
                <Text style={[styles.td, styles.num, { width: COLS[7][1] }, r.marginOnBilled < 0 ? styles.bad : styles.good]}>{r.billed ? `${r.marginOnBilledPct}%` : '—'}</Text>
                <Text style={[styles.td, styles.num, { width: COLS[8][1] }, r.lossItems > 0 && styles.bad]}>{r.lossItems}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <Text style={styles.muted}>Margin = billed (before GST) minus material, labour and other costs. Labour is estimated from attendance hours and pay rates.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  td: { padding: 8, fontSize: 14, color: colors.text },
  num: { textAlign: 'right' },
  good: { color: colors.success, fontWeight: '700' },
  bad: { color: colors.danger, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
});
