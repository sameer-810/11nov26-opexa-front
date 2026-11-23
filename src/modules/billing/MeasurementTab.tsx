import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseNumber, todayLocal } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { TextField } from '../../shared/ui/TextField';
import { colors } from '../../shared/designSystem';
import { s, useAction, useData } from '../inventory/ui';
import { billingApi } from './billingApi';
import { QuantityLadder } from './components/QuantityLadder';
import { SheetCard } from './components/SheetCard';

type Row = { description: string; nos: string; length: string; breadth: string; height: string; formula: string; deduct: boolean };
const blank: Row = { description: '', nos: '1', length: '', breadth: '', height: '', formula: '', deduct: false };
const FIELDS = ['description', 'nos', 'length', 'breadth', 'height', 'formula'] as const;
const ALL = '';

// Low-side measurement (back) sheets: measure zone / department / floor wise, correct (history kept), approve, then bill.
export function MeasurementTab({ projectId, onInvoice }: { projectId: string; onInvoice: (id: string) => void }) {
  const fetcher = useCallback(async () => ({ sheets: await billingApi.sheets(projectId), position: await billingApi.position(projectId) }), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [item, setItem] = useState('');
  const [where, setWhere] = useState({ zone: '', department: '', floor: '' });
  const [rows, setRows] = useState<Row[]>([{ ...blank }]);
  const [pick, setPick] = useState<string[]>([]);
  const [filter, setFilter] = useState<{ key: 'zone' | 'department' | 'floor'; value: string }>({ key: 'floor', value: ALL });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const n = (v: string) => parseNumber(v) ?? undefined;
  const create = () => run('sheet', async () => {
    await billingApi.createSheet(projectId, { workOrderItemId: item, ...where, measuredOn: todayLocal(), rows: rows.map((r) => ({ description: r.description, nos: n(r.nos), length: n(r.length), breadth: n(r.breadth), height: n(r.height), formula: r.formula, deduct: r.deduct })) });
    setRows([{ ...blank }]);
  });
  const line = (itemId: string) => data.position.lowSide.find((x) => x.workOrderItemId === itemId);
  const values = [...new Set(data.sheets.map((sh) => sh[filter.key]).filter(Boolean))];
  const shown = data.sheets.filter((sh) => filter.value === ALL || sh[filter.key] === filter.value);
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <View style={s.list} testID="measure-tab">
      {problem ? <ErrorBanner message={problem} testID="ms-problem" /> : null}
      {data.position.lowSide.map((l) => <QuantityLadder key={l.workOrderItemId} line={l} />)}
      <View style={s.form}>
        <Text style={s.title}>New measurement sheet</Text>
        <ChoiceChips label="BOQ item (low-side)" options={data.position.lowSide.map((l) => ({ value: l.workOrderItemId, label: `${l.serialNo} ${l.description.slice(0, 25)} (${l.unit})` }))} value={item} onChange={setItem} testID="ms-item" />
        <View style={s.row}>
          {(['zone', 'department', 'floor'] as const).map((k) => <View key={k} style={s.cell}><TextField label={k[0].toUpperCase() + k.slice(1)} value={where[k]} onChangeText={(v) => setWhere({ ...where, [k]: v })} testID={`ms-${k}`} /></View>)}
        </View>
        {rows.map((r, i) => (
          <View key={`${i}`} style={s.row}>
            {FIELDS.map((k) => <View key={k} style={s.cell}><TextField label={k === 'formula' ? 'working / formula' : k} value={r[k]} onChangeText={(v) => setRow(i, { [k]: v })} keyboardType={k === 'description' || k === 'formula' ? 'default' : 'decimal-pad'} testID={`ms-${k}-${i}`} /></View>)}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.deduct }} onPress={() => setRow(i, { deduct: !r.deduct })} testID={`ms-deduct-${i}`}>
              <Text style={[s.muted, { color: r.deduct ? colors.danger : colors.textMuted }]}>{r.deduct ? '☑' : '☐'} Deduction</Text>
            </Pressable>
          </View>
        ))}
        <View style={s.row}><Button title="Add row" variant="ghost" onPress={() => setRows([...rows, { ...blank }])} testID="ms-add-row" /><Button title="Save sheet" onPress={create} loading={busy === 'sheet'} testID="ms-save" /></View>
      </View>
      {data.sheets.length ? (
        <View style={s.row}>
          <ChoiceChips label="Group by" options={[{ value: 'zone', label: 'Zone' }, { value: 'department', label: 'Department' }, { value: 'floor', label: 'Floor' }]} value={filter.key} onChange={(v) => setFilter({ key: v as typeof filter.key, value: ALL })} testID="ms-group" />
          <ChoiceChips label="Show" options={[{ value: ALL, label: 'All' }, ...values.map((v) => ({ value: v, label: v }))]} value={filter.value} onChange={(v) => setFilter({ ...filter, value: v })} testID="ms-filter" />
        </View>
      ) : null}
      {shown.map((sh) => (
        <SheetCard key={sh.id} sheet={sh} projectId={projectId} serialNo={line(sh.workOrderItemId)?.serialNo ?? ''} picked={pick.includes(sh.id)} onPick={() => setPick(pick.includes(sh.id) ? pick.filter((x) => x !== sh.id) : [...pick, sh.id])} run={run} busy={busy} onError={setProblem} />
      ))}
      {pick.length ? <Button title={`Invoice ${pick.length} approved sheet(s)`} onPress={() => run('inv', async () => { const x = await billingApi.measurementInvoice(projectId, pick, todayLocal()); setPick([]); onInvoice(x.id); })} loading={busy === 'inv'} testID="ms-invoice" /> : null}
    </View>
  );
}
