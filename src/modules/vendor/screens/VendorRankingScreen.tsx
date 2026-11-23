import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { TextField } from '../../../shared/ui/TextField';
import { s, useData } from '../../inventory/ui';
import { vendorApi } from '../api/vendorApi';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorRanking'>;
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const ymd = /^\d{4}-\d{2}-\d{2}$/;

// 2A.3: suppliers ranked by on-time delivery, complete and undamaged supply and invoice accuracy.
export function VendorRankingScreen({ navigation }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const fetcher = useCallback(() => vendorApi.ranking(applied), [applied]);
  const { data, error, reload } = useData(fetcher);
  const valid = (!from || ymd.test(from)) && (!to || ymd.test(to));

  return (
    <AppScreen title="Supplier performance" subtitle={data ? `${data.from} to ${data.to}` : undefined} onBack={() => navigation.navigate('Vendors')} testID="vendor-ranking-screen">
      <View style={s.row}>
        <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} testID="rank-from" /></View>
        <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} testID="rank-to" /></View>
        <Button title="Apply" variant="ghost" disabled={!valid} onPress={() => setApplied({ from: from || undefined, to: to || undefined })} testID="rank-apply" />
      </View>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {data?.vendors.length === 0 ? <EmptyState title="No deliveries, POs or invoices in this period" /> : null}
      <View style={s.list}>
        {data?.vendors.map((v, i) => (
          <Pressable key={v.vendorId} style={s.card} onPress={() => navigation.navigate('VendorDetail', { id: v.vendorId })} testID={`rank-${v.vendorName}`} accessibilityRole="button">
            <Text style={s.number}>#{i + 1} {v.vendorName} · score {v.score ?? '—'}</Text>
            <Text style={s.muted}>On time {pct(v.onTimePct)} · lead {v.avgLeadDays === null ? '—' : `${v.avgLeadDays} days`} · short {pct(v.shortPct)} · damaged {pct(v.damagedPct)} · invoice mismatches {v.invoiceMismatches}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
