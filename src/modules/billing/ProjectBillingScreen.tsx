import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';
import { billingApi } from './billingApi';
import { SlabsTab } from './SlabsTab';
import { MeasurementTab } from './MeasurementTab';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectBilling'>;

function Receivables({ projectId }: { projectId: string }) {
  const fetcher = useCallback(() => billingApi.receivables(projectId), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [amt, setAmt] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <View style={s.list} testID="recv-tab">
      {problem ? <ErrorBanner message={problem} /> : null}
      <Text style={s.title}>Outstanding {formatMoney(data.total)} · {data.byBucket.map((b) => `${b.bucket} days ${formatMoney(b.amount)}`).join(' · ')}</Text>
      {data.rows.map((r) => (
        <View key={r.invoiceId} style={s.card}>
          <Text style={s.number}>{r.number} · {formatDate(r.invoiceDate)} · {r.ageDays} days</Text>
          <Text style={s.muted}>Total {formatMoney(r.total)} − retention {formatMoney(r.retention)} − received {formatMoney(r.received)} − TDS {formatMoney(r.tds)} = outstanding {formatMoney(r.outstanding)}</Text>
          <View style={s.row}>
            <TextField label="Received ₹" value={amt[`a-${r.invoiceId}`] ?? ''} onChangeText={(v) => setAmt((x) => ({ ...x, [`a-${r.invoiceId}`]: v }))} keyboardType="decimal-pad" testID={`rcpt-${r.number}`} />
            <TextField label="TDS ₹" value={amt[`t-${r.invoiceId}`] ?? ''} onChangeText={(v) => setAmt((x) => ({ ...x, [`t-${r.invoiceId}`]: v }))} keyboardType="decimal-pad" />
            <Button title="Record payment" onPress={() => run(r.invoiceId, () => billingApi.receipt(r.invoiceId, { amount: parseNumber(amt[`a-${r.invoiceId}`] ?? '') ?? 0, tds: parseNumber(amt[`t-${r.invoiceId}`] ?? '') ?? 0, date: todayLocal() }))} loading={busy === r.invoiceId} testID={`rcpt-save-${r.number}`} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProjectBillingScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [tab, setTab] = useState('slabs');
  const openInvoice = (invoiceId: string) => navigation.navigate('InvoiceDetail', { id: invoiceId });
  return (
    <AppScreen title="Client billing" subtitle="High-side by payment terms, low-side by client-verified measurement" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-billing-screen">
      <ChoiceChips label="Section" options={[{ value: 'slabs', label: 'Payment terms' }, { value: 'measure', label: 'Measurement sheets' }, { value: 'recv', label: 'Receivables' }]} value={tab} onChange={setTab} testID="billing-tab" />
      {tab === 'slabs' ? <SlabsTab projectId={id} onInvoice={openInvoice} /> : null}
      {tab === 'measure' ? <MeasurementTab projectId={id} onInvoice={openInvoice} /> : null}
      {tab === 'recv' ? <Receivables projectId={id} /> : null}
    </AppScreen>
  );
}
