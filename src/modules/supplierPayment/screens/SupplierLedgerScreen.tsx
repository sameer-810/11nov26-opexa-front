import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { saveBlob } from '../../../shared/download';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { TextField } from '../../../shared/ui/TextField';
import { errText, s, useData } from '../../inventory/ui';
import { supplierPaymentApi } from '../supplierPaymentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierLedger'>;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

// Supplier statement: invoices, payments and TDS with a running balance payable; Excel download.
export function SupplierLedgerScreen({ navigation, route }: Props) {
  const { vendorId } = route.params;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const fetcher = useCallback(() => supplierPaymentApi.ledger(vendorId, applied), [vendorId, applied]);
  const { data, error, reload } = useData(fetcher);

  const apply = () => {
    if ((from && !ymd.test(from)) || (to && !ymd.test(to))) return setProblem('Enter dates as YYYY-MM-DD');
    setProblem('');
    return setApplied({ from: from || undefined, to: to || undefined });
  };
  const download = async () => {
    setBusy(true);
    try { if (!saveBlob(await supplierPaymentApi.ledgerExcel(vendorId, applied), `supplier-ledger-${applied.from || 'all'}-to-${applied.to || 'today'}.xlsx`)) setProblem('Open this on the web to download the Excel file.'); } catch (e) { setProblem(errText(e)); } finally { setBusy(false); }
  };

  if (error) return <AppScreen title="Supplier ledger" onBack={() => navigation.navigate('Payables')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  return (
    <AppScreen title="Supplier ledger" subtitle={data?.vendor.name} onBack={() => navigation.navigate('Payables')} right={<Button title="Excel" variant="outline" onPress={() => void download()} loading={busy} testID="ledger-excel" />} testID="supplier-ledger-screen">
      {problem ? <ErrorBanner message={problem} testID="ledger-problem" /> : null}
      <View style={s.row}>
        <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} testID="ledger-from" /></View>
        <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} testID="ledger-to" /></View>
        <Button title="Apply" variant="ghost" onPress={apply} testID="ledger-apply" />
      </View>
      {!data ? <ActivityIndicator /> : null}
      {data ? <Text style={s.muted}>Opening balance {formatMoney(data.opening)}</Text> : null}
      {data?.rows.length === 0 ? <EmptyState title="No entries in this period" /> : null}
      <View style={s.list}>
        {data?.rows.map((r) => (
          <View key={`${r.type}-${r.id}`} style={s.card} testID={`ledger-${r.type}-${r.ref}`}>
            <Text style={s.title}>{formatDate(r.date)} · {r.type === 'invoice' ? 'Invoice' : r.type === 'tds' ? 'TDS' : 'Payment'} {r.ref}</Text>
            <Text style={s.muted}>{r.narration}</Text>
            <Text style={r.credit ? s.title : s.muted}>{r.credit ? `Credit ${formatMoney(r.credit)}` : `Debit ${formatMoney(r.debit)}`} · balance {formatMoney(r.balance)}</Text>
          </View>
        ))}
      </View>
      {data ? <Text style={s.number} testID="ledger-closing">Closing balance payable {formatMoney(data.closing)}</Text> : null}
      {data && data.advanceUnadjusted > 0 ? <Text style={s.warn}>Advance not adjusted {formatMoney(data.advanceUnadjusted)}</Text> : null}
    </AppScreen>
  );
}
