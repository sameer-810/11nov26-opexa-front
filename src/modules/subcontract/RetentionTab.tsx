import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { saveBlob } from '../../shared/download';
import { formatDate, formatMoney, parseNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';
import { subcontractApi, type Agreement, type RetentionPosition, type Subcontractor } from './subcontractApi';

const ENTRY = { certificate: 'Certificate', payment: 'Payment', retention_release: 'Retention release' } as const;

// 3G: retention release (after the DLP, or earlier with a reason) -> approval -> payment; and the payment register.
export function RetentionTab({ agreements, subs, pm, finance }: { agreements: Agreement[]; subs: Subcontractor[]; pm: boolean; finance: boolean }) {
  const [subId, setSubId] = useState('');
  const fetcher = useCallback(async () => ({ releases: await subcontractApi.releases(), register: await subcontractApi.register(subId) }), [subId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [agrId, setAgrId] = useState('');
  const [pos, setPos] = useState<RetentionPosition | null>(null);
  const [f, setF] = useState({ amount: '', basis: 'dlp_completed', reason: '', pay: {} as Record<string, string> });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const pick = (id: string) => { setAgrId(id); setPos(null); void run('pos', async () => setPos(await subcontractApi.retention(id))); };
  const excel = () => run('xlsx', async () => { if (!saveBlob(await subcontractApi.registerExcel(subId), 'subcontract-payment-register.xlsx')) setProblem('Open this on the web to download the Excel file.'); });
  return (
    <View style={s.list} testID="sc-retention">
      {problem ? <ErrorBanner message={problem} testID="ret-problem" /> : null}
      {pm ? (
        <View style={s.form}>
          <Text style={s.title}>Release retention</Text>
          <ChoiceChips label="Agreement" options={agreements.map((a) => ({ value: a.id, label: `${a.number} · ${a.title}` }))} value={agrId} onChange={pick} testID="ret-agreement" />
          {pos ? <Text style={s.muted} testID="ret-position">Held {formatMoney(pos.held)} · released {formatMoney(pos.released)} · available {formatMoney(pos.available)} · DLP {pos.dlpEndsOn ? `ends ${formatDate(pos.dlpEndsOn)}` : 'not set'}</Text> : null}
          <ChoiceChips label="Basis" options={[{ value: 'dlp_completed', label: 'DLP / handover completed' }, { value: 'manual', label: 'Early release (give reason)' }]} value={f.basis} onChange={(v) => setF((x) => ({ ...x, basis: v }))} testID="ret-basis" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Amount (₹)" value={f.amount} onChangeText={(t) => setF((x) => ({ ...x, amount: t }))} keyboardType="decimal-pad" testID="ret-amount" /></View>
            <View style={s.cell}><TextField label="Reason" value={f.reason} onChangeText={(t) => setF((x) => ({ ...x, reason: t }))} testID="ret-reason" /></View>
          </View>
          <Button title="Request release" loading={busy === 'rel'} testID="ret-save" onPress={() => void run('rel', () => subcontractApi.requestRelease({ agreementId: agrId, amount: parseNumber(f.amount) ?? 0, basis: f.basis === 'manual' ? 'manual' : 'dlp_completed', reason: f.reason || undefined }))} />
        </View>
      ) : null}
      {data.releases.map((r) => (
        <View key={r.id} style={s.card} testID={`rel-${r.number}`}>
          <View style={s.row}><Text style={s.number}>{r.number}</Text><StatusChip label={r.status.replace('_', ' ')} tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} /><Text style={s.muted}>{formatMoney(r.amount)} · {r.basis === 'manual' ? `early: ${r.reason}` : 'after DLP'} · paid {formatMoney(r.paid)}</Text></View>
          {finance && r.outstanding > 0 ? (
            <View style={s.row}>
              <TextField label="Pay amount" value={f.pay[r.id] ?? ''} onChangeText={(t) => setF((x) => ({ ...x, pay: { ...x.pay, [r.id]: t } }))} keyboardType="decimal-pad" testID={`rel-pay-${r.number}`} />
              <Button title="Record payment" onPress={() => void run(`pay-${r.id}`, () => subcontractApi.payRelease(r.id, parseNumber(f.pay[r.id] ?? '') ?? 0))} testID={`rel-pay-save-${r.number}`} />
            </View>
          ) : null}
        </View>
      ))}
      <View style={s.row}>
        <Text style={[s.title, s.cell]}>Payment register</Text>
        <Button title="Excel" variant="outline" onPress={() => void excel()} loading={busy === 'xlsx'} testID="reg-excel" />
      </View>
      <ChoiceChips label="Subcontractor" options={[{ value: '', label: 'All' }, ...subs.map((x) => ({ value: x.id, label: x.name }))]} value={subId} onChange={setSubId} testID="reg-sub" />
      {data.register.rows.map((r, i) => (
        <Text key={`${r.reference}-${i}`} style={s.muted} testID={`reg-row-${i}`}>
          {formatDate(r.date)} · {r.subcontractor} · {ENTRY[r.type]} {r.reference}
          {r.type === 'certificate' ? ` · gross ${formatMoney(r.gross)} − deductions ${formatMoney(r.deductions)} − retention ${formatMoney(r.retention)} − advance ${formatMoney(r.advanceRecovery)} = ${formatMoney(r.payable)}` : ''}
          {r.type === 'retention_release' ? ` · ${formatMoney(r.payable)} payable` : ''}
          {r.type === 'payment' ? ` · paid ${formatMoney(r.paid)}` : ''} · balance {formatMoney(r.balance)}
        </Text>
      ))}
      <Text style={s.title} testID="reg-totals">Payable {formatMoney(data.register.totals.payable)} · paid {formatMoney(data.register.totals.paid)} · balance {formatMoney(data.register.totals.balance)}</Text>
    </View>
  );
}
