import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import { s, useAction, useData } from '../ui';

// Material master, and stock adjustments waiting for approval.
export function MaterialsTab() {
  const fetcher = useCallback(async () => ({ materials: await inventoryApi.materials(), adjustments: await inventoryApi.adjustments() }), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [min, setMin] = useState('');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const pending = data.adjustments.filter((a) => a.status === 'pending');
  return (
    <View style={s.list} testID="materials-tab">
      {problem ? <ErrorBanner message={problem} /> : null}
      {pending.length ? (
        <View style={s.form}>
          <Text style={s.title}>Stock adjustments waiting for approval</Text>
          {pending.map((a) => (
            <View key={a.id} style={s.card} testID={`adj-${a.number}`}>
              <Text style={s.number}>{a.number} · {formatDate(a.createdAt)} · {a.reason}</Text>
              {a.lines.map((l) => <Text key={l.id} style={s.muted}>{l.name}: books {formatNumber(l.bookQty)}, counted {formatNumber(l.physicalQty)} → {l.qty > 0 ? '+' : ''}{formatNumber(l.qty)} {l.unit}</Text>)}
              <View style={s.row}>
                <Button title="Approve" onPress={() => run(`a-${a.id}`, () => inventoryApi.decideAdjustment(a.id, 'approved'))} loading={busy === `a-${a.id}`} testID={`adj-approve-${a.number}`} />
                <Button title="Reject" variant="ghost" onPress={() => run(`x-${a.id}`, () => inventoryApi.decideAdjustment(a.id, 'rejected'))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.form}>
        <Text style={s.title}>Add material</Text>
        <View style={s.row}>
          <View style={s.cell}><TextField label="Name" value={name} onChangeText={setName} testID="mat-name" /></View>
          <View style={s.cell}><TextField label="Unit" value={unit} onChangeText={setUnit} placeholder="Rmt, Nos, Kg" testID="mat-unit" /></View>
          <View style={s.cell}><TextField label="Category" value={category} onChangeText={setCategory} /></View>
          <View style={s.cell}><TextField label="Minimum stock (store)" value={min} onChangeText={setMin} keyboardType="decimal-pad" /></View>
        </View>
        <Button title="Save material" onPress={() => run('add', async () => { await inventoryApi.createMaterial({ name, unit, category: category || undefined, minStock: parseNumber(min) ?? undefined }); setName(''); setUnit(''); setCategory(''); setMin(''); })} loading={busy === 'add'} testID="mat-save" />
      </View>
      {data.materials.map((m) => (
        <View key={m.id} style={s.card}>
          <View style={s.row}><Text style={s.title}>{m.code} · {m.name}</Text>{!m.isActive ? <StatusChip label="Inactive" tone="neutral" /> : null}</View>
          <Text style={s.muted}>{m.unit}{m.category ? ` · ${m.category}` : ''}{m.minStock ? ` · minimum ${formatNumber(m.minStock)}` : ''}</Text>
        </View>
      ))}
    </View>
  );
}
