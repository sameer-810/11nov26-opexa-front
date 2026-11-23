import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { saveBlob } from '../../shared/download';
import { formatDate, formatMoney } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { TextField } from '../../shared/ui/TextField';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { receiptsApi, type Ledger, type Reconciliation } from './receivablesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientLedger'>;

// 4G: statement per client (or one project) with a running balance and Excel; reconciliation of invoices,
// receipts and notes, money on account and anything that disagrees.
export function ClientLedgerScreen({ navigation }: Props) {
  const projects = useData(useCallback(() => projectApi.list(), []));
  const [scope, setScope] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('ledger');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const { busy, problem, run } = useAction(() => undefined);
  if (projects.error) return <AppScreen title="Client ledger" onBack={() => navigation.navigate('ClientReceipts')}><ErrorState message={projects.error} onRetry={projects.reload} /></AppScreen>;
  const [kind, value] = scope.split(':');
  const filter = { ...(kind === 'client' ? { client: value } : { projectId: value }), from: from || undefined, to: to || undefined };
  const clients = [...new Set((projects.data ?? []).map((p) => p.clientName))];
  const options = [...clients.map((c) => ({ value: `client:${c}`, label: `${c} (all projects)` })), ...(projects.data ?? []).map((p) => ({ value: `project:${p.id}`, label: `${p.code} ${p.name}` }))];
  const load = () => run('load', async () => { if (tab === 'ledger') setLedger(await receiptsApi.ledger(filter)); else setRecon(await receiptsApi.reconciliation(filter)); });

  return (
    <AppScreen title="Client ledger" subtitle="Invoices, credit / debit notes, receipts, TDS and advances with a running balance" onBack={() => navigation.navigate('ClientReceipts')} testID="client-ledger-screen">
      {problem ? <ErrorBanner message={problem} testID="cl-problem" /> : null}
      <ChoiceChips label="Client or project" value={scope} onChange={setScope} options={options} testID="cl-scope" />
      <ChoiceChips label="View" value={tab} onChange={setTab} options={[{ value: 'ledger', label: 'Ledger' }, { value: 'recon', label: 'Reconciliation' }]} testID="cl-tab" />
      <View style={s.row}>
        {tab === 'ledger' ? <><View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} /></View><View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} /></View></> : null}
        <Button title="Show" onPress={load} loading={busy === 'load'} disabled={!scope} testID="cl-show" />
        {tab === 'ledger' && scope ? <Button title="Excel" variant="outline" onPress={() => run('xlsx', async () => { saveBlob(await receiptsApi.ledgerXlsx(filter), 'opexa-client-ledger.xlsx'); })} loading={busy === 'xlsx'} testID="cl-excel" /> : null}
      </View>
      {tab === 'ledger' && ledger ? (
        <View style={s.list} testID="cl-ledger">
          <Text style={s.title}>Opening {formatMoney(ledger.opening)} · closing {formatMoney(ledger.closing)} · retention held {formatMoney(ledger.retentionHeld)} · on account {formatMoney(ledger.onAccount)}</Text>
          {ledger.rows.map((r, i) => (
            <View key={i} style={s.row}>
              <Text style={[s.muted, s.cell]}>{formatDate(r.date)} · {r.ref} · {r.narration}</Text>
              <Text style={s.muted}>{r.debit ? `Dr ${formatMoney(r.debit)}` : `Cr ${formatMoney(r.credit)}`}</Text>
              <Text style={s.title}>{formatMoney(r.balance)}</Text>
            </View>
          ))}
          {!ledger.rows.length ? <Text style={s.muted}>Nothing in this period.</Text> : null}
        </View>
      ) : null}
      {tab === 'recon' && recon ? (
        <View style={s.list} testID="cl-recon">
          <Text style={s.title}>Invoiced {formatMoney(recon.totals.invoiced)} · credit notes {formatMoney(recon.totals.credited)} · debit notes {formatMoney(recon.totals.debited)} · received {formatMoney(recon.totals.received)} · outstanding {formatMoney(recon.totals.outstanding)}</Text>
          <Text style={recon.mismatches ? s.danger : s.muted}>{recon.mismatches ? `${recon.mismatches} invoice(s) need a look` : 'Invoices, receipts and notes agree'}</Text>
          {recon.rows.map((r) => (
            <View key={r.invoiceId} style={s.card}>
              <Text style={s.title}>{r.number} · {r.project} · {r.status}</Text>
              <Text style={s.muted}>Total {formatMoney(r.total)} · CN {formatMoney(r.credited)} · DN {formatMoney(r.debited)} · received {formatMoney(r.receivedOnInvoice + r.allocated)} · retention {formatMoney(r.retention)}{r.advanceRecovery ? ` · advance recovered ${formatMoney(r.advanceRecovery)}` : ''} · outstanding {formatMoney(r.outstanding)}</Text>
              {r.flags.map((f) => <Text key={f} style={s.danger}>{f}</Text>)}
            </View>
          ))}
          {recon.unallocated.length ? <Text style={s.warn}>On account, not yet allocated: {recon.unallocated.map((u) => `${u.number} ${formatMoney(u.onAccount)}`).join(', ')}</Text> : null}
          {recon.onAccountNotes.length ? <Text style={s.muted}>Notes on account: {recon.onAccountNotes.map((n) => `${n.number} ${formatMoney(n.total)}`).join(', ')}</Text> : null}
        </View>
      ) : null}
    </AppScreen>
  );
}
