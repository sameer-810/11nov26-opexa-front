import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { formatMoney, formatNumber, parseNumber } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, canEditBoq, PERMS } from '../../shared/permissions';
import { s, useAction, useData } from '../inventory/ui';
import { BoqProfitTab } from './BoqProfitTab';
import { ChangeRequestsTab } from './ChangeRequestsTab';
import { ExtraMaterialsTab } from './ExtraMaterialsTab';
import { LINE_CATS, LUMP_CATS, projectFinanceApi } from './projectFinanceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectFinance'>;
const pct = (v: number | null) => (v == null ? '—' : `${v}%`);

function Profit({ id }: { id: string }) {
  const fetcher = useCallback(() => projectFinanceApi.financials(id), [id]);
  const { data: f, error, reload } = useData(fetcher);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!f) return null;
  return (
    <View style={s.list} testID="pf-profit">
      {f.overrun ? <ErrorBanner message="Actual + committed cost is above the estimate (alert threshold passed)." /> : null}
      <View style={s.card}>
        <Text style={s.title}>Margin: estimated {f.estimate.cost ? pct(f.estimate.marginPct) : 'not set (no estimate yet)'} → forecast {pct(f.forecast.marginPct)}</Text>
        {f.actualMargin ? <Text style={f.actualMargin.value < 0 ? s.danger : s.muted} testID="pf-actual-margin">At today's actual cost: margin {formatMoney(f.actualMargin.value)} ({pct(f.actualMargin.pct)}) on contract {formatMoney(f.revenue.contract)}</Text> : null}
        <Text style={s.muted} testID="pf-summary">Contract {formatMoney(f.revenue.contract)} · estimated cost {formatMoney(f.estimate.cost)} · actual {formatMoney(f.actual.cost)} · committed {formatMoney(f.committed.cost)} · forecast {formatMoney(f.forecast.cost)}</Text>
        <Text style={s.muted}>Billed {formatMoney(f.revenue.billed)} · margin on billed {formatMoney(f.marginOnBilled.value)} ({pct(f.marginOnBilled.pct)}) · material consumed {formatMoney(f.consumedMaterial)} · lying at site {formatMoney(f.materialAtSite)} · supplier bills {formatMoney(f.supplierInvoiced)}</Text>
      </View>
      {f.categories.map((c) => (
        <Text key={c.key} style={c.variance > 0 ? s.danger : s.muted}>{c.key}: estimate {formatMoney(c.estimate)} · actual {formatMoney(c.actual)} · committed {formatMoney(c.committed)} · forecast {formatMoney(c.forecast)}</Text>
      ))}
      <Text style={s.title}>Material by BOQ line</Text>
      {f.lines.map((l) => <Text key={l.workOrderItemId} style={l.materialVariance > 0 ? s.danger : s.muted}>S.No {l.serialNo} {l.description}: estimate {formatMoney(l.estimatedMaterial)} · actual {formatMoney(l.actualMaterial)}{l.packageMaterial ? ` (incl. package ${formatMoney(l.packageMaterial)})` : ''}{!l.tendered ? ' · additional work' : ''}</Text>)}
      {f.notes.map((n) => <Text key={n} style={s.muted}>• {n}</Text>)}
    </View>
  );
}

function EstimateTab({ id, editable }: { id: string; editable: boolean }) {
  const fetcher = useCallback(() => projectFinanceApi.estimate(id), [id]);
  const { data: e, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [overhead, setOverhead] = useState('');
  const [lump, setLump] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!e) return null;
  const v = (lineId: string, c: string, cur: number) => vals[`${lineId}:${c}`] ?? (cur ? String(cur) : '');
  const save = () => run('save', () => projectFinanceApi.saveEstimate(id, {
    overheadEstimate: parseNumber(overhead) ?? undefined,
    estimateLumpSum: Object.fromEntries(Object.entries(lump).map(([k, t]) => [k, parseNumber(t) ?? 0])),
    lines: e.lines.map((l) => ({ workOrderItemId: l.workOrderItemId, ...Object.fromEntries(LINE_CATS.map((c) => [c, parseNumber(v(l.workOrderItemId, c, l.perUnit[c] ?? 0)) ?? 0])) })),
  }));
  return (
    <View style={s.list} testID="pf-estimate">
      {problem ? <ErrorBanner message={problem} /> : null}
      <Text style={s.title} testID="pf-est-summary">Estimated cost {formatMoney(e.cost)} on revenue {formatMoney(e.revenue)} · margin {formatMoney(e.margin)} ({pct(e.marginPct)})</Text>
      <TextField label="Project overheads (₹)" value={overhead || (e.overheadEstimate ? String(e.overheadEstimate) : '')} onChangeText={setOverhead} keyboardType="decimal-pad" editable={editable} />
      <Text style={s.muted}>Project-level amounts (not per BOQ line, e.g. transport), added to the line estimates:</Text>
      <View style={s.row}>{LUMP_CATS.map((c) => <View key={c} style={s.cell}><TextField label={`${c} (₹)`} value={lump[c] ?? (e.lumpSum?.[c] ? String(e.lumpSum[c]) : '')} onChangeText={(t) => setLump((x) => ({ ...x, [c]: t }))} keyboardType="decimal-pad" editable={editable} testID={`est-lump-${c}`} /></View>)}</View>
      {e.lines.map((l) => (
        <View key={l.workOrderItemId} style={s.card}>
          <Text style={s.title}>S.No {l.serialNo} {l.description} · {formatNumber(l.quantity)} {l.unit} @ {formatMoney(l.rate)}</Text>
          <Text style={s.muted}>Cost per {l.unit}:</Text>
          <View style={s.row}>{LINE_CATS.map((c) => <View key={c} style={s.cell}><TextField label={c} value={v(l.workOrderItemId, c, l.perUnit[c] ?? 0)} onChangeText={(t) => setVals((x) => ({ ...x, [`${l.workOrderItemId}:${c}`]: t }))} keyboardType="decimal-pad" editable={editable} testID={`est-${l.serialNo}-${c}`} /></View>)}</View>
          <Text style={l.margin < 0 ? s.danger : s.muted}>Line cost {formatMoney(l.totalCost)} · margin {formatMoney(l.margin)} ({pct(l.marginPct)})</Text>
        </View>
      ))}
      {editable ? <Button title="Save estimate" onPress={save} loading={busy === 'save'} testID="est-save" /> : <Text style={s.muted} testID="est-readonly">Read only: the PM or a BOQ editor sets the estimate.</Text>}
    </View>
  );
}

function BoqChanges({ id }: { id: string }) {
  const { user } = useAuth();
  const fetcher = useCallback(async () => ({ reg: await projectFinanceApi.regularisation(id), revs: await projectFinanceApi.revisions(id), est: await projectFinanceApi.estimate(id), crs: await projectFinanceApi.changeRequests(id) }), [id]);
  const [crId, setCrId] = useState('');
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [w, setW] = useState({ serialNo: '', description: '', unit: '', quantity: '', rate: '', reason: '' });
  const [refs, setRefs] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const set = (k: keyof typeof w) => (t: string) => setW((x) => ({ ...x, [k]: t }));
  return (
    <View style={s.list} testID="pf-boq">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.row}>
        <StatusChip label={data.est.boqLocked ? `BOQ approved & locked · revision ${data.est.boqRevision}` : 'BOQ not approved yet'} tone={data.est.boqLocked ? 'success' : 'warning'} />
        {!data.est.boqLocked ? <Button title={user?.role === 'owner' ? 'Approve & lock BOQ' : 'Submit BOQ for MD approval'} variant="outline" onPress={() => run('lock', () => projectFinanceApi.lock(id))} testID="boq-lock" /> : null}
      </View>
      <Text style={s.title} testID="reg-summary">Excess {data.reg.summary.excessLines} line(s) {formatMoney(data.reg.summary.excessValue)} · additional work {data.reg.summary.additionalLines} line(s) {formatMoney(data.reg.summary.additionalValue)} · awaiting client confirmation {data.reg.summary.unconfirmedAdditional}</Text>
      {data.reg.rows.filter((r) => !r.tendered || r.excess > 0).map((r) => (
        <View key={r.workOrderItemId} style={s.card}>
          <Text style={s.title}>S.No {r.serialNo} {r.description}</Text>
          <Text style={s.muted}>BOQ {formatNumber(r.boqQty)} · executed {formatNumber(r.executed)} · billed {formatNumber(r.billed)} {r.unit} · {r.status}{r.clientApprovalRef ? ` · ${r.clientApprovalRef}` : ''}</Text>
          {r.status.endsWith('awaiting client confirmation') ? (
            <View style={s.row}>
              <TextField label="Client approval reference" value={refs[r.workOrderItemId] ?? ''} onChangeText={(t) => setRefs((x) => ({ ...x, [r.workOrderItemId]: t }))} />
              <Button title="Regularise" onPress={() => run(`r-${r.workOrderItemId}`, () => projectFinanceApi.regularise(id, r.workOrderItemId, refs[r.workOrderItemId] ?? ''))} />
            </View>
          ) : null}
        </View>
      ))}
      <View style={s.form}>
        <Text style={s.title}>Record additional (non-tendered) work</Text>
        <View style={s.row}>
          <View style={s.cell}><TextField label="S.No" value={w.serialNo} onChangeText={set('serialNo')} testID="aw-serial" /></View>
          <View style={s.cell}><TextField label="Description" value={w.description} onChangeText={set('description')} testID="aw-desc" /></View>
          <View style={s.cell}><TextField label="Unit" value={w.unit} onChangeText={set('unit')} /></View>
          <View style={s.cell}><TextField label="Quantity" value={w.quantity} onChangeText={set('quantity')} keyboardType="decimal-pad" /></View>
          <View style={s.cell}><TextField label="Rate ₹" value={w.rate} onChangeText={set('rate')} keyboardType="decimal-pad" /></View>
        </View>
        <TextField label="Why (client instruction)" value={w.reason} onChangeText={set('reason')} />
        {data.crs.some((c) => c.status === 'raised' || c.status === 'client_approved') ? <ChoiceChips label="Change request" options={[{ value: '', label: 'None' }, ...data.crs.filter((c) => c.status === 'raised' || c.status === 'client_approved').map((c) => ({ value: c.id, label: c.number }))]} value={crId} onChange={setCrId} testID="aw-cr" /> : null}
        <Button title="Add to register" onPress={() => run('aw', async () => { await projectFinanceApi.addWork(id, { ...w, quantity: parseNumber(w.quantity) ?? 0, rate: parseNumber(w.rate) ?? 0, ...(crId ? { changeRequestId: crId } : {}) }); setW({ serialNo: '', description: '', unit: '', quantity: '', rate: '', reason: '' }); })} loading={busy === 'aw'} testID="aw-save" />
      </View>
      <Text style={s.title}>BOQ revisions</Text>
      {data.revs.map((r) => <Text key={r.id} style={s.muted}>Rev {r.revisionNo} · {r.status.replace('_', ' ')} · {r.reason} · {r.changes.length} change(s)</Text>)}
    </View>
  );
}

export function ProjectFinanceScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [tab, setTab] = useState('profit');
  const { user } = useAuth();
  const pm = can(user, PERMS.PROJECT_MANAGE);
  return (
    <AppScreen title="Estimate & profit" subtitle="Estimated vs actual cost, BOQ revisions and additional work" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-finance-screen">
      <ChoiceChips label="Section" options={[{ value: 'profit', label: 'Profit' }, { value: 'lines', label: 'BOQ-wise profit' }, { value: 'estimate', label: 'Estimate' }, { value: 'extras', label: 'Extra materials' }, { value: 'changes', label: 'Change requests' }, { value: 'boq', label: 'BOQ changes' }]} value={tab} onChange={setTab} />
      {tab === 'profit' ? <Profit id={id} /> : null}
      {tab === 'estimate' ? <EstimateTab id={id} editable={canEditBoq(user)} /> : null}
      {tab === 'boq' ? <BoqChanges id={id} /> : null}
      {tab === 'lines' ? <BoqProfitTab id={id} /> : null}
      {tab === 'extras' ? <ExtraMaterialsTab id={id} canLink={pm || can(user, PERMS.PURCHASE_MANAGE)} /> : null}
      {tab === 'changes' ? <ChangeRequestsTab id={id} pm={pm} /> : null}
    </AppScreen>
  );
}
