import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api, apiBlob } from '../../shared/api/apiClient';
import { saveBlob } from '../../shared/download';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Tally'>;
type Exp = { id: string; kind: string; from: string; to: string; vouchers: number; total: number; status: string; reexportReason: string; confirmation: { importedCount: number } | null; createdAt: string };

// Sales, purchase and receipt vouchers for Tally; each document is exported once; the import is reconciled.
export function TallyScreen({ navigation }: Props) {
  const fetcher = useCallback(() => api<Exp[]>('/tally/exports'), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [kind, setKind] = useState('sales');
  const [from, setFrom] = useState(`${todayLocal().slice(0, 8)}01`);
  const [to, setTo] = useState(todayLocal());
  const [reason, setReason] = useState('');
  const [imported, setImported] = useState<Record<string, string>>({});
  if (error) return <AppScreen title="Tally export" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const download = (e: Exp) => run(`dl-${e.id}`, async () => { saveBlob(await apiBlob(`/tally/exports/${e.id}/file`), `opexa-tally-${e.kind}-${e.from}-to-${e.to}.xml`); });
  return (
    <AppScreen title="Tally export" subtitle="Vouchers are checked to balance before export; each document goes to Tally once" onBack={() => navigation.navigate('Dashboard')} testID="tally-screen">
      {problem ? <ErrorBanner message={problem} testID="tally-problem" /> : null}
      <View style={s.form}>
        <ChoiceChips label="Vouchers" options={[{ value: 'sales', label: 'Sales (client invoices)' }, { value: 'purchase', label: 'Purchase (supplier invoices)' }, { value: 'receipt', label: 'Receipts' }]} value={kind} onChange={setKind} testID="tally-kind" />
        <View style={s.row}>
          <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} /></View>
          <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} /></View>
          <View style={s.cell}><TextField label="Reason (only to export again)" value={reason} onChangeText={setReason} /></View>
        </View>
        <Button title="Create export" onPress={() => run('gen', () => api('/tally/exports', { method: 'POST', body: { kind, from, to, ...(reason ? { reexport: true, reason } : {}) } }))} loading={busy === 'gen'} testID="tally-create" />
      </View>
      {data?.map((e) => (
        <View key={e.id} style={s.card} testID={`tally-${e.id}`}>
          <View style={s.row}><Text style={s.title}>{e.kind} · {formatDate(e.from)} to {formatDate(e.to)}</Text><StatusChip label={e.status} tone={e.status === 'confirmed' ? (e.confirmation?.importedCount === e.vouchers ? 'success' : 'danger') : e.status === 'superseded' ? 'neutral' : 'info'} /></View>
          <Text style={s.muted}>{e.vouchers} voucher(s) · {formatMoney(e.total)}{e.confirmation ? ` · Tally imported ${e.confirmation.importedCount}` : ''}{e.reexportReason ? ` · re-export: ${e.reexportReason}` : ''}</Text>
          <View style={s.row}>
            <Button title="Download XML" variant="outline" onPress={() => download(e)} />
            {e.status === 'generated' ? <><TextField label="Vouchers Tally imported" value={imported[e.id] ?? ''} onChangeText={(v) => setImported((x) => ({ ...x, [e.id]: v }))} keyboardType="number-pad" /><Button title="Confirm import" onPress={() => run(`c-${e.id}`, () => api(`/tally/exports/${e.id}/confirm`, { method: 'POST', body: { importedCount: parseNumber(imported[e.id] ?? '') ?? 0 } }))} /></> : null}
          </View>
        </View>
      ))}
    </AppScreen>
  );
}
