import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { inventoryApi } from '../api/inventoryApi';
import { s, useAction, useData } from '../ui';

// Material issued to subcontractors / staff (from a warehouse, or package material from a site),
// then returned or confirmed as consumed.
export function IssuesTab() {
  const fetcher = useCallback(async () => {
    const [issues, warehouses, stock, projects] = await Promise.all([inventoryApi.issues(), inventoryApi.warehouses(), inventoryApi.stock(), projectApi.list().catch(() => [])]);
    return { issues, warehouses, stock, projects };
  }, []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [fromKind, setFromKind] = useState<'warehouse' | 'site'>('warehouse');
  const [from, setFrom] = useState('');
  const [kind, setKind] = useState<'subcontractor' | 'employee' | 'other'>('subcontractor');
  const [who, setWho] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [settle, setSettle] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const avail = data.stock.filter((r) => r.location.kind === fromKind && r.location.id === from && r.available > 0);
  return (
    <View style={s.list} testID="issues-tab">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.form}>
        <Text style={s.title}>Issue material</Text>
        <Text style={s.muted}>From a site, only package (non-billable) material is issued; BOQ items are recorded as installed.</Text>
        <ChoiceChips label="From" options={[{ value: 'warehouse', label: 'Warehouse' }, { value: 'site', label: 'Project site' }]} value={fromKind} onChange={(v) => { setFromKind(v as 'warehouse' | 'site'); setFrom(''); }} />
        <ChoiceChips label={fromKind === 'site' ? 'Project' : 'Warehouse'} options={fromKind === 'site' ? data.projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` })) : data.warehouses.map((w) => ({ value: w.id, label: w.name }))} value={from} onChange={setFrom} testID="issue-from" />
        <ChoiceChips label="Issue to" options={[{ value: 'subcontractor', label: 'Subcontractor' }, { value: 'employee', label: 'Employee' }, { value: 'other', label: 'Other' }]} value={kind} onChange={(v) => setKind(v as typeof kind)} />
        <TextField label="Name" value={who} onChangeText={setWho} testID="issue-who" />
        {avail.map((r) => <View key={r.materialId} style={s.row}><Text style={[s.muted, s.cell]}>{r.name}: {formatNumber(r.available)} {r.unit}</Text><TextField label="Qty" value={qtys[r.materialId] ?? ''} onChangeText={(v) => setQtys((q) => ({ ...q, [r.materialId]: v }))} keyboardType="decimal-pad" /></View>)}
        <Button title="Issue" onPress={() => run('issue', async () => { await inventoryApi.createIssue({ from: { kind: fromKind, id: from }, issuedTo: { kind, name: who }, lines: avail.map((r) => ({ materialId: r.materialId, qty: parseNumber(qtys[r.materialId] ?? '') ?? 0, ...(fromKind === 'site' ? { billable: false } : {}) })).filter((l) => l.qty > 0) }); setQtys({}); })} loading={busy === 'issue'} testID="issue-save" />
      </View>
      {data.issues.map((i) => (
        <View key={i.id} style={s.card} testID={`issue-${i.number}`}>
          <View style={s.row}><Text style={s.number}>{i.number}</Text><StatusChip label={i.status} tone={i.status === 'closed' ? 'neutral' : 'info'} /></View>
          <Text style={s.title}>To {i.issuedTo.name} ({i.issuedTo.kind}) · {formatDate(i.createdAt)}</Text>
          {i.lines.map((l) => (
            <View key={l.id} style={s.row}>
              <Text style={[s.muted, s.cell]}>{l.name}: issued {formatNumber(l.qty)} · returned {formatNumber(l.qtyReturned)} · consumed {formatNumber(l.qtyConsumed)} · with holder {formatNumber(l.withHolder)} {l.unit}</Text>
              {i.status === 'issued' && l.withHolder > 0 ? (
                <>
                  <TextField label="Qty" value={settle[l.id] ?? ''} onChangeText={(v) => setSettle((x) => ({ ...x, [l.id]: v }))} keyboardType="decimal-pad" />
                  <Button title="Returned" variant="outline" onPress={() => run(`r-${l.id}`, () => inventoryApi.settleIssue(i.id, 'return', [{ lineId: l.id, qty: parseNumber(settle[l.id] ?? '') ?? 0 }]))} />
                  <Button title="Consumed" variant="ghost" onPress={() => run(`c-${l.id}`, () => inventoryApi.settleIssue(i.id, 'consume', [{ lineId: l.id, qty: parseNumber(settle[l.id] ?? '') ?? 0 }]))} />
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
