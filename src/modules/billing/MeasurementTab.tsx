import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatNumber, parseNumber, todayLocal } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { colors } from '../../shared/designSystem';
import { s, useAction, useData } from '../inventory/ui';
import { billingApi } from './billingApi';

type Row = { description: string; nos: string; length: string; breadth: string; height: string };
const blank: Row = { description: '', nos: '1', length: '', breadth: '', height: '' };

// Low-side measurement (back) sheets: measure zone-wise, client engineer corrects, approve, then bill.
export function MeasurementTab({ projectId, onInvoice }: { projectId: string; onInvoice: (id: string) => void }) {
  const fetcher = useCallback(async () => ({ sheets: await billingApi.sheets(projectId), position: await billingApi.position(projectId) }), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [item, setItem] = useState('');
  const [zone, setZone] = useState('');
  const [rows, setRows] = useState<Row[]>([{ ...blank }]);
  const [fix, setFix] = useState<Record<string, string>>({});
  const [engineer, setEngineer] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const n = (v: string) => parseNumber(v) ?? undefined;
  const create = () => run('sheet', async () => {
    await billingApi.createSheet(projectId, { workOrderItemId: item, zone, measuredOn: todayLocal(), rows: rows.map((r) => ({ description: r.description, nos: n(r.nos), length: n(r.length), breadth: n(r.breadth), height: n(r.height) })) });
    setRows([{ ...blank }]);
  });
  const label = (itemId: string) => data.position.lowSide.find((x) => x.workOrderItemId === itemId);

  return (
    <View style={s.list} testID="measure-tab">
      {problem ? <ErrorBanner message={problem} testID="ms-problem" /> : null}
      {data.position.lowSide.map((l) => <Text key={l.workOrderItemId} style={s.muted}>S.No {l.serialNo} {l.description}: BOQ {formatNumber(l.boqQty)}{l.variationQty != null ? ` · variation ${formatNumber(l.variationQty)}` : ''} · executed {formatNumber(l.executedQty)} · measured {formatNumber(l.measuredQty)} · approved {formatNumber(l.approvedQty)} · billed {formatNumber(l.billedQty)} {l.unit}</Text>)}
      <View style={s.form}>
        <Text style={s.title}>New measurement sheet</Text>
        <ChoiceChips label="BOQ item (low-side)" options={data.position.lowSide.map((l) => ({ value: l.workOrderItemId, label: `${l.serialNo} ${l.description.slice(0, 25)}` }))} value={item} onChange={setItem} testID="ms-item" />
        <TextField label="Zone / floor" value={zone} onChangeText={setZone} testID="ms-zone" />
        {rows.map((r, i) => (
          <View key={`${i}`} style={s.row}>
            {(['description', 'nos', 'length', 'breadth', 'height'] as const).map((k) => <View key={k} style={s.cell}><TextField label={k} value={r[k]} onChangeText={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} keyboardType={k === 'description' ? 'default' : 'decimal-pad'} testID={`ms-${k}-${i}`} /></View>)}
          </View>
        ))}
        <View style={s.row}><Button title="Add row" variant="ghost" onPress={() => setRows([...rows, { ...blank }])} /><Button title="Save sheet" onPress={create} loading={busy === 'sheet'} testID="ms-save" /></View>
      </View>
      {data.sheets.map((sh) => (
        <View key={sh.id} style={s.card} testID={`sheet-${sh.number}`}>
          <View style={s.row}>
            {sh.status === 'approved' && !sh.invoiceId ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: pick.includes(sh.id) }} onPress={() => setPick(pick.includes(sh.id) ? pick.filter((x) => x !== sh.id) : [...pick, sh.id])} testID={`ms-pick-${sh.number}`}><Text style={[s.title, { color: colors.primary }]}>{pick.includes(sh.id) ? '☑' : '☐'}</Text></Pressable> : null}
            <Text style={s.number}>{sh.number}</Text><StatusChip label={sh.invoiceId ? 'billed' : sh.status.replace('_', ' ')} tone={sh.status === 'approved' ? 'success' : 'info'} />
            <Text style={s.muted}>S.No {label(sh.workOrderItemId)?.serialNo} · {sh.zone} · measured {formatNumber(sh.measuredQty)} → final {formatNumber(sh.finalQty)}{sh.clientEngineer ? ` · verified by ${sh.clientEngineer}` : ''}</Text>
          </View>
          {sh.rows.map((r) => (
            <View key={r.id} style={s.row}>
              <Text style={[s.muted, s.cell]}>{r.description || 'Row'}: {formatNumber(r.qty)}{r.correctedQty != null ? ` → ${formatNumber(r.correctedQty)} (client)` : ''}</Text>
              {sh.status === 'submitted' ? <TextField label="Client figure" value={fix[r.id] ?? ''} onChangeText={(v) => setFix((x) => ({ ...x, [r.id]: v }))} keyboardType="decimal-pad" testID={`ms-fix-${r.id}`} /> : null}
            </View>
          ))}
          <View style={s.row}>
            {sh.status === 'draft' ? <Button title="Send to client" variant="outline" onPress={() => run(`s-${sh.id}`, () => billingApi.sheetAction(projectId, sh.id, { action: 'submit' }))} testID={`ms-submit-${sh.number}`} /> : null}
            {sh.status === 'submitted' ? <><TextField label="Client engineer" value={engineer} onChangeText={setEngineer} testID="ms-engineer" /><Button title="Record client verification" onPress={() => run(`v-${sh.id}`, () => billingApi.sheetAction(projectId, sh.id, { action: 'client_verify', clientEngineer: engineer, corrections: sh.rows.filter((r) => parseNumber(fix[r.id] ?? '') !== null).map((r) => ({ rowId: r.id, correctedQty: parseNumber(fix[r.id] ?? '') ?? r.qty })) }))} testID={`ms-verify-${sh.number}`} /></> : null}
            {sh.status === 'client_verified' ? <Button title="Approve" onPress={() => run(`a-${sh.id}`, () => billingApi.sheetAction(projectId, sh.id, { action: 'approve' }))} testID={`ms-approve-${sh.number}`} /> : null}
          </View>
        </View>
      ))}
      {pick.length ? <Button title={`Invoice ${pick.length} approved sheet(s)`} onPress={() => run('inv', async () => { const x = await billingApi.measurementInvoice(projectId, pick, todayLocal()); setPick([]); onInvoice(x.id); })} loading={busy === 'inv'} testID="ms-invoice" /> : null}
    </View>
  );
}
