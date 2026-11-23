import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatMoney, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { inventoryApi } from '../api/inventoryApi';
import { s, useAction, useData } from '../ui';
import { COUNT_STATUS, CountSheet } from './CountSheet';

const SCOPES = [{ value: 'all', label: 'Everything in stock' }, { value: 'category', label: 'One category' }];

// Physical verification (2F.4) of a warehouse or a site against the stock ledger.
export function CountsTab() {
  const fetcher = useCallback(async () => {
    const [counts, warehouses, projects] = await Promise.all([inventoryApi.counts(), inventoryApi.warehouses(), projectApi.list().catch(() => [])]);
    return { counts, warehouses, projects: projects.filter((p) => p.status !== 'closed') };
  }, []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [openId, setOpenId] = useState('');
  const [kind, setKind] = useState<'warehouse' | 'site'>('warehouse');
  const [where, setWhere] = useState('');
  const [scope, setScope] = useState<'all' | 'category'>('all');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayLocal());

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (openId) return <CountSheet id={openId} onClose={() => { setOpenId(''); void reload(); }} />;
  const places = kind === 'warehouse' ? (data?.warehouses ?? []).map((w) => ({ value: w.id, label: w.name })) : (data?.projects ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }));
  const start = () => run('start', async () => {
    const c = await inventoryApi.startCount({ location: { kind, id: where }, countDate: date, scope: scope === 'category' ? { type: 'category', category: category.trim() } : { type: 'all' } });
    setOpenId(c.id);
  });

  return (
    <View style={s.list} testID="counts-tab">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.form}>
        <Text style={s.title}>Start a physical count</Text>
        <ChoiceChips label="Count at" options={[{ value: 'warehouse', label: 'Warehouse' }, { value: 'site', label: 'Project site' }]} value={kind} onChange={(v) => { setKind(v as typeof kind); setWhere(''); }} testID="count-kind" />
        <ChoiceChips label={kind === 'warehouse' ? 'Warehouse' : 'Project'} options={places} value={where} onChange={setWhere} testID="count-location" />
        <ChoiceChips label="Materials" options={SCOPES} value={scope} onChange={(v) => setScope(v as typeof scope)} testID="count-scope" />
        <View style={s.row}>
          {scope === 'category' ? <View style={s.cell}><TextField label="Category" value={category} onChangeText={setCategory} testID="count-category" /></View> : null}
          <View style={s.cell}><TextField label="Count date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="count-date" /></View>
        </View>
        <Text style={s.muted}>The system quantity of each item is taken from the stock ledger now. One count at a time per location.</Text>
        <Button title="Start count" onPress={() => void start()} disabled={!where} loading={busy === 'start'} testID="count-start" style={s.self} />
      </View>
      {data?.counts.length === 0 ? <Text style={s.muted}>No physical counts yet.</Text> : null}
      {data?.counts.map((c) => (
        <View key={c.id} style={s.card} testID={`count-${c.number}`}>
          <View style={s.row}>
            <Text style={s.number}>{c.number}</Text>
            <Text style={s.title}>{c.location.name}</Text>
            <StatusChip label={COUNT_STATUS[c.status].label} tone={COUNT_STATUS[c.status].tone} />
          </View>
          <Text style={s.muted}>{formatDate(c.countDate)} · by {c.countedBy.name} · {c.totals.counted}/{c.totals.lines} counted · {c.totals.withVariance} differ · net {formatMoney(c.totals.netValue)}</Text>
          <Button title="Open" variant="outline" onPress={() => setOpenId(c.id)} testID={`count-open-${c.number}`} style={s.self} />
        </View>
      ))}
    </View>
  );
}
