import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, PERMS } from '../../shared/permissions';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { receiptsApi, type ClientReceipt, type OpenInvoice } from './receivablesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientReceipts'>;
const MODES = ['neft', 'rtgs', 'cheque', 'upi', 'cash', 'other'].map((m) => ({ value: m, label: m.toUpperCase() }));
const allocationsOf = (amounts: Record<string, string>) => Object.entries(amounts).map(([invoiceId, v]) => ({ invoiceId, amount: parseNumber(v) ?? 0 })).filter((a) => a.amount > 0);
// Fills the oldest invoices first, up to what is available.
const fifo = (invoices: OpenInvoice[], available: number) => {
  let left = available;
  return Object.fromEntries(invoices.map((i) => { const a = Math.max(0, Math.min(left, i.outstanding)); left -= a; return [i.id, a ? String(Math.round(a * 100) / 100) : '']; }));
};

function Allocator({ invoices, amounts, onChange }: { invoices: OpenInvoice[]; amounts: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  if (!invoices.length) return <Text style={s.muted}>No invoice of this client is waiting for payment: the whole amount stays on account.</Text>;
  return (
    <View style={s.list}>
      {invoices.map((i) => (
        <View key={i.id} style={s.row} testID={`rc-open-${i.number}`}>
          <Text style={[s.muted, s.cell]}>{i.number} · {formatDate(i.invoiceDate)} · {i.project} · due {formatMoney(i.outstanding)}</Text>
          <TextField label="Allocate ₹" value={amounts[i.id] ?? ''} onChangeText={(v) => onChange({ ...amounts, [i.id]: v })} keyboardType="decimal-pad" testID={`rc-alloc-${i.number}`} />
        </View>
      ))}
    </View>
  );
}

// 4G: payments received from clients, allocated across invoices; the rest on account, adjusted later.
export function ClientReceiptsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const write = can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT);
  const md = can(user, PERMS.INVOICE_EDIT);
  const [projectId, setProjectId] = useState('');
  const fetcher = useCallback(async () => ({ projects: await projectApi.list(), receipts: await receiptsApi.list(projectId ? { projectId } : {}), open: projectId ? await receiptsApi.openInvoices({ projectId }) : [] }), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [f, setF] = useState({ date: todayLocal(), mode: 'neft', reference: '', amount: '', tds: '' });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState<{ receipt: ClientReceipt; invoices: OpenInvoice[]; amounts: Record<string, string> } | null>(null);
  const [cancelWhy, setCancelWhy] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  if (error) return <AppScreen title="Client receipts" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const gross = (parseNumber(f.amount) ?? 0) + (parseNumber(f.tds) ?? 0);
  const allocated = allocationsOf(amounts).reduce((t, a) => t + a.amount, 0);

  const save = () => run('save', async () => {
    await receiptsApi.create({ projectId, date: f.date, mode: f.mode, reference: f.reference.trim() || undefined, amount: parseNumber(f.amount) ?? 0, tds: parseNumber(f.tds) ?? 0, allocations: allocationsOf(amounts) });
    setF({ date: todayLocal(), mode: 'neft', reference: '', amount: '', tds: '' }); setAmounts({});
  });
  const startAdjust = (r: ClientReceipt) => run(`adj-${r.id}`, async () => {
    const invoices = await receiptsApi.openInvoices(r.projectId ? { projectId: r.projectId } : { client: r.clientName });
    setAdjusting({ receipt: r, invoices, amounts: fifo(invoices, r.onAccount) });
  });

  return (
    <AppScreen title="Client receipts" subtitle="Payments received, allocated to invoices; advances kept on account" onBack={() => navigation.navigate('Dashboard')} testID="client-receipts-screen">
      <View style={s.row}>
        <Button title="Client ledger & reconciliation" variant="outline" onPress={() => navigation.navigate('ClientLedger')} testID="rc-ledger" />
        <Button title="Credit & debit notes" variant="outline" onPress={() => navigation.navigate('Notes', undefined)} testID="rc-notes" />
      </View>
      {problem ? <ErrorBanner message={problem} testID="rc-problem" /> : null}
      {data ? <ChoiceChips label="Project (client)" value={projectId} onChange={(v) => { setProjectId(v); setAmounts({}); }} options={[{ value: '', label: 'All' }, ...data.projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name} · ${p.clientName}` }))]} testID="rc-project" /> : null}
      {write && projectId && data ? (
        <View style={s.form} testID="rc-form">
          <Text style={s.title}>Record a payment received</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Date (YYYY-MM-DD)" value={f.date} onChangeText={set('date')} /></View>
            <View style={s.cell}><TextField label="Amount received ₹" value={f.amount} onChangeText={set('amount')} keyboardType="decimal-pad" testID="rc-amount" /></View>
            <View style={s.cell}><TextField label="TDS deducted ₹" value={f.tds} onChangeText={set('tds')} keyboardType="decimal-pad" /></View>
            <View style={s.cell}><TextField label="UTR / cheque no." value={f.reference} onChangeText={set('reference')} /></View>
          </View>
          <ChoiceChips label="Mode" value={f.mode} onChange={set('mode')} options={MODES} />
          <Allocator invoices={data.open} amounts={amounts} onChange={setAmounts} />
          <Text style={allocated > gross + 0.005 ? s.danger : s.muted} testID="rc-split">Allocated {formatMoney(allocated)} of {formatMoney(gross)} · on account {formatMoney(Math.max(0, gross - allocated))}</Text>
          <View style={s.row}>
            <Button title="Allocate oldest first" variant="ghost" onPress={() => setAmounts(fifo(data.open, gross))} />
            <Button title="Save receipt" onPress={save} loading={busy === 'save'} testID="rc-save" />
          </View>
        </View>
      ) : null}
      {adjusting ? (
        <View style={s.form} testID="rc-adjust">
          <Text style={s.title}>Adjust {adjusting.receipt.number}: {formatMoney(adjusting.receipt.onAccount)} on account</Text>
          <Allocator invoices={adjusting.invoices} amounts={adjusting.amounts} onChange={(a) => setAdjusting({ ...adjusting, amounts: a })} />
          <View style={s.row}>
            <Button title="Adjust against invoices" onPress={() => run('adjust', async () => { await receiptsApi.allocate(adjusting.receipt.id, allocationsOf(adjusting.amounts)); setAdjusting(null); })} loading={busy === 'adjust'} testID="rc-adjust-save" />
            <Button title="Close" variant="ghost" onPress={() => setAdjusting(null)} />
          </View>
        </View>
      ) : null}
      {data?.receipts.map((r) => (
        <View key={r.id} style={s.card} testID={`rc-${r.number}`}>
          <View style={s.row}><Text style={s.title}>{r.number} · {r.clientName}{r.projectName ? ` · ${r.projectName}` : ''}</Text><StatusChip label={r.status === 'cancelled' ? 'Cancelled' : r.onAccount > 0.005 ? `On account ${formatMoney(r.onAccount)}` : 'Allocated'} tone={r.status === 'cancelled' ? 'neutral' : r.onAccount > 0.005 ? 'warning' : 'success'} /></View>
          <Text style={s.muted}>{formatDate(r.date)} · {r.mode.toUpperCase()} {r.reference} · {formatMoney(r.amount)}{r.tds ? ` + TDS ${formatMoney(r.tds)}` : ''} · {r.allocations.map((a) => `${a.invoiceNumber} ${formatMoney(a.amount)}`).join(', ') || 'not allocated'}</Text>
          {r.cancelled ? <Text style={s.danger}>Cancelled: {r.cancelled.reason}</Text> : null}
          {r.status === 'active' ? (
            <View style={s.row}>
              {write && r.onAccount > 0.005 ? <Button title="Adjust against invoices" variant="outline" onPress={() => startAdjust(r)} loading={busy === `adj-${r.id}`} testID={`rc-adjust-${r.number}`} /> : null}
              {md ? <><TextField label="Cancel reason" value={cancelWhy[r.id] ?? ''} onChangeText={(v) => setCancelWhy((x) => ({ ...x, [r.id]: v }))} /><Button title="Cancel receipt" variant="ghost" onPress={() => run(`c-${r.id}`, () => receiptsApi.cancel(r.id, (cancelWhy[r.id] ?? '').trim()))} /></> : null}
            </View>
          ) : null}
        </View>
      ))}
      {data && !data.receipts.length ? <Text style={s.muted}>No client receipts{projectId ? ' for this project' : ''} yet. Receipts entered on an invoice show on that invoice.</Text> : null}
    </AppScreen>
  );
}
