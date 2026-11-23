import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api, apiBlob } from '../../shared/api/apiClient';
import { saveBlob } from '../../shared/download';
import { openPrint } from '../invoice/invoiceApi';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Commitments'>;
type RetRow = { projectId: string; projectCode: string; projectName: string; client: string; held: number; released: number; claimedOpen: number; outstanding: number; releaseDueDate: string | null; due: boolean; daysToRelease: number | null; retentionPct: number | null; retentionBase: 'taxable' | 'gross'; dlpMonths?: number };
type Batch = { invoiceId: string; number: string; retention: number; retentionPct: number; retentionBase: string; expectedRelease: string };
type Claim = { id: string; amount: number; reference: string; status: string; releasedAmount: number };
type Bg = { id: string; number: string; type: string; bank: string; beneficiary: string; amount: number; expiryDate: string; status: string; daysToExpiry: number; expiringSoon: boolean; expiredNotClosed: boolean; renewals: unknown[]; alertDays: number | null; leadDays: number };

const C = '/commitments';
const post = (path: string, body: unknown) => api(`${C}${path}`, { method: 'POST', body });

export function CommitmentsScreen({ navigation }: Props) {
  const [tab, setTab] = useState('retention');
  const fetcher = useCallback(async () => ({
    ret: await api<{ rows: RetRow[]; totalOutstanding: number; byClient: { client: string; outstanding: number }[] }>(`${C}/retention`),
    bgs: await api<{ rows: Bg[]; outstanding: number; expiringSoon: number; expiredNotClosed: number; leadDays: number }>(`${C}/bank-guarantees`),
  }), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [f, setF] = useState<Record<string, string>>({});
  const [claims, setClaims] = useState<Record<string, Claim[]>>({});
  const [batches, setBatches] = useState<Record<string, Batch[]>>({});
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const v = (k: string) => f[k] ?? '';
  if (error) return <AppScreen title="Retention & guarantees" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const loadClaims = async (pid: string) => { const r = await api<{ claims: Claim[]; batches: Batch[] }>(`${C}/retention/${pid}`); setClaims((x) => ({ ...x, [pid]: r.claims })); setBatches((x) => ({ ...x, [pid]: r.batches })); };
  const download = (key: string, path: string, name: string) => run(key, async () => { saveBlob(await apiBlob(`${C}${path}`), name); });

  return (
    <AppScreen title="Retention & guarantees" subtitle="Retention held by clients and bank guarantees, with release and expiry reminders" onBack={() => navigation.navigate('Dashboard')} testID="commitments-screen">
      <ChoiceChips label="Section" options={[{ value: 'retention', label: 'Retention' }, { value: 'bg', label: 'Bank guarantees' }]} value={tab} onChange={setTab} testID="cm-tab" />
      {problem ? <ErrorBanner message={problem} testID="cm-problem" /> : null}
      {data && tab === 'retention' ? (
        <View style={s.list}>
          <Text style={s.title} testID="ret-total">Retention outstanding {formatMoney(data.ret.totalOutstanding)}</Text>
          <View style={s.row}>
            <Button title="Register to Excel" variant="outline" onPress={() => download('rx', '/retention/export', 'opexa-retention-register.xlsx')} loading={busy === 'rx'} testID="ret-export" />
            <Button title="Print register" variant="outline" onPress={() => run('rp', async () => openPrint((await api<{ url: string }>(`${C}/retention/print-link`)).url))} loading={busy === 'rp'} testID="ret-print" />
          </View>
          {data.ret.byClient.map((c) => <Text key={c.client} style={s.muted}>{c.client}: {formatMoney(c.outstanding)}</Text>)}
          {data.ret.rows.map((r) => (
            <View key={r.projectId} style={s.card} testID={`ret-${r.projectCode}`}>
              <View style={s.row}><Text style={s.title}>{r.projectCode} {r.projectName}</Text>{r.due ? <StatusChip label="Release due — claim now" tone="danger" /> : null}</View>
              <Text style={s.muted}>Retention {r.retentionPct == null ? 'as per billing plan' : `${r.retentionPct}%`} on {r.retentionBase === 'gross' ? 'gross' : 'taxable'} value · held {formatMoney(r.held)} · released {formatMoney(r.released)} · claimed {formatMoney(r.claimedOpen)} · outstanding {formatMoney(r.outstanding)} · release {r.releaseDueDate ? formatDate(r.releaseDueDate) : 'date not set'}</Text>
              <View style={s.row}>
                <TextField label="Handover date (YYYY-MM-DD)" value={v(`h-${r.projectId}`)} onChangeText={set(`h-${r.projectId}`)} />
                <TextField label="DLP months" value={v(`d-${r.projectId}`)} onChangeText={set(`d-${r.projectId}`)} keyboardType="number-pad" />
                <TextField label="Retention % (blank: plan)" value={v(`p-${r.projectId}`)} onChangeText={set(`p-${r.projectId}`)} keyboardType="decimal-pad" testID={`ret-pct-${r.projectCode}`} />
                <ChoiceChips label="On" value={v(`b-${r.projectId}`) || r.retentionBase} onChange={set(`b-${r.projectId}`)} options={[{ value: 'taxable', label: 'Taxable value' }, { value: 'gross', label: 'Gross (with GST)' }]} />
                <Button title="Save terms" variant="outline" onPress={() => run(`t-${r.projectId}`, () => api(`${C}/retention/${r.projectId}/terms`, { method: 'PUT', body: { ...(v(`h-${r.projectId}`) ? { handoverDate: v(`h-${r.projectId}`) } : {}), dlpMonths: parseNumber(v(`d-${r.projectId}`)) ?? r.dlpMonths ?? 12, retentionPct: v(`p-${r.projectId}`) ? parseNumber(v(`p-${r.projectId}`)) : r.retentionPct, retentionBase: (v(`b-${r.projectId}`) || r.retentionBase) as 'taxable' | 'gross' } }))} testID={`ret-terms-${r.projectCode}`} />
              </View>
              <View style={s.row}>
                <TextField label="Claim ₹" value={v(`c-${r.projectId}`)} onChangeText={set(`c-${r.projectId}`)} keyboardType="decimal-pad" testID={`ret-claim-${r.projectCode}`} />
                <TextField label="Claim letter ref" value={v(`cr-${r.projectId}`)} onChangeText={set(`cr-${r.projectId}`)} testID={`ret-ref-${r.projectCode}`} />
                <Button title="Submit claim" onPress={() => run(`c-${r.projectId}`, async () => { await post(`/retention/${r.projectId}/claims`, { amount: parseNumber(v(`c-${r.projectId}`)) ?? 0, claimedOn: todayLocal(), reference: v(`cr-${r.projectId}`) }); await loadClaims(r.projectId); })} testID={`ret-claim-save-${r.projectCode}`} />
                <Button title="Show claims" variant="ghost" onPress={() => void loadClaims(r.projectId)} />
              </View>
              {(batches[r.projectId] || []).map((b) => <Text key={b.invoiceId} style={s.muted}>{b.number}: {formatMoney(b.retention)} ({b.retentionPct}% of {b.retentionBase}) · expected release {formatDate(b.expectedRelease)}</Text>)}
              {(claims[r.projectId] || []).map((c) => (
                <View key={c.id} style={s.row}>
                  <Text style={[s.muted, s.cell]}>{c.reference}: {formatMoney(c.amount)} · {c.status}{c.releasedAmount ? ` · released ${formatMoney(c.releasedAmount)}` : ''}</Text>
                  {c.status === 'submitted' ? <><TextField label="Received ref (UTR)" value={v(`rr-${c.id}`)} onChangeText={set(`rr-${c.id}`)} /><Button title="Mark released" onPress={() => run(`r-${c.id}`, async () => { await post(`/retention/${r.projectId}/claims/${c.id}/decision`, { decision: 'released', reference: v(`rr-${c.id}`) }); await loadClaims(r.projectId); })} /></> : null}
                </View>
              ))}
            </View>
          ))}
          {!data.ret.rows.length ? <Text style={s.muted}>No retention held yet. It builds up from issued invoices on projects with a retention %.</Text> : null}
        </View>
      ) : null}
      {data && tab === 'bg' ? (
        <View style={s.list}>
          <Text style={s.title}>Active guarantees {formatMoney(data.bgs.outstanding)} · expiring within {data.bgs.leadDays} days {data.bgs.expiringSoon} · expired, not closed {data.bgs.expiredNotClosed}</Text>
          <View style={s.row}>
            <TextField label="Alert days before expiry / release (company)" value={v('lead') || String(data.bgs.leadDays)} onChangeText={set('lead')} keyboardType="number-pad" testID="bg-lead" />
            <Button title="Save" variant="outline" onPress={() => run('lead', () => api(`${C}/settings`, { method: 'PUT', body: { alertLeadDays: parseNumber(v('lead')) ?? data.bgs.leadDays } }))} testID="bg-lead-save" />
            <Button title="Register to Excel" variant="outline" onPress={() => download('bx', '/bank-guarantees/export', 'opexa-bank-guarantees.xlsx')} loading={busy === 'bx'} testID="bg-export" />
          </View>
          <View style={s.form}>
            <Text style={s.title}>Register a bank guarantee</Text>
            <View style={s.row}>
              {['number', 'bank', 'beneficiary', 'amount', 'issueDate', 'expiryDate'].map((k) => <View key={k} style={s.cell}><TextField label={k === 'issueDate' || k === 'expiryDate' ? `${k} (YYYY-MM-DD)` : k} value={v(`bg-${k}`)} onChangeText={set(`bg-${k}`)} keyboardType={k === 'amount' ? 'decimal-pad' : 'default'} testID={`bg-${k}`} /></View>)}
            </View>
            <ChoiceChips label="Type" options={[{ value: 'performance', label: 'Performance' }, { value: 'advance_payment', label: 'Advance' }, { value: 'retention', label: 'Retention' }, { value: 'bid', label: 'Bid' }]} value={v('bg-type') || 'performance'} onChange={set('bg-type')} />
            <Button title="Save" onPress={() => run('bg', () => post('/bank-guarantees', { number: v('bg-number'), bank: v('bg-bank'), beneficiary: v('bg-beneficiary'), amount: parseNumber(v('bg-amount')) ?? 0, issueDate: v('bg-issueDate'), expiryDate: v('bg-expiryDate'), type: v('bg-type') || 'performance' }))} loading={busy === 'bg'} testID="bg-save" />
          </View>
          {data.bgs.rows.map((b) => (
            <View key={b.id} style={s.card} testID={`bg-${b.number}`}>
              <View style={s.row}><Text style={s.title}>{b.number} · {b.bank}</Text><StatusChip label={b.expiredNotClosed ? 'Expired — not closed' : b.expiringSoon ? `Expires in ${b.daysToExpiry} days` : b.status} tone={b.expiredNotClosed || b.expiringSoon ? 'danger' : b.status === 'active' ? 'info' : 'neutral'} /></View>
              <Text style={s.muted}>{b.type.replace('_', ' ')} · {formatMoney(b.amount)} to {b.beneficiary} · expires {formatDate(b.expiryDate)} · {b.renewals.length} renewal(s)</Text>
              {b.status === 'active' ? (
                <View style={s.row}>
                  <TextField label="New expiry" value={v(`ne-${b.id}`)} onChangeText={set(`ne-${b.id}`)} />
                  <TextField label="Reference" value={v(`ref-${b.id}`)} onChangeText={set(`ref-${b.id}`)} />
                  <Button title="Renew" variant="outline" onPress={() => run(`rn-${b.id}`, () => post(`/bank-guarantees/${b.id}/renew`, { newExpiry: v(`ne-${b.id}`), reference: v(`ref-${b.id}`) }))} />
                  <Button title="Released" variant="ghost" onPress={() => run(`cl-${b.id}`, () => post(`/bank-guarantees/${b.id}/close`, { action: 'released', reference: v(`ref-${b.id}`) }))} />
                  <TextField label={`Alert days (now ${b.leadDays}${b.alertDays ? '' : ', company'})`} value={v(`al-${b.id}`)} onChangeText={set(`al-${b.id}`)} keyboardType="number-pad" testID={`bg-alert-${b.number}`} />
                  <Button title="Set alert" variant="ghost" onPress={() => run(`al-${b.id}`, () => api(`${C}/bank-guarantees/${b.id}/alert`, { method: 'PUT', body: { alertDays: parseNumber(v(`al-${b.id}`)) } }))} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}
