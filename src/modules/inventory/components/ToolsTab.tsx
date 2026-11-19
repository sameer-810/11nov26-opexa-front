import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import { s, useAction, useData } from '../ui';

// Tools and equipment register: issue to staff / subcontractors, return with condition, missing.
export function ToolsTab() {
  const fetcher = useCallback(() => inventoryApi.tools(), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [holderKind, setHolderKind] = useState<'employee' | 'subcontractor' | 'other'>('employee');
  const [holder, setHolder] = useState('');
  const [open, setOpen] = useState('');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <View style={s.list} testID="tools-tab">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="New tool / equipment" value={name} onChangeText={setName} placeholder="e.g. Hilti drilling machine" testID="tool-name" /></View>
          <View style={s.cell}><TextField label="Serial no." value={serial} onChangeText={setSerial} /></View>
        </View>
        <Button title="Add to register" onPress={() => run('add', async () => { await inventoryApi.createTool({ name, serialNo: serial || undefined }); setName(''); setSerial(''); })} loading={busy === 'add'} testID="tool-add" />
      </View>
      {data?.map((t) => (
        <View key={t.id} style={s.card} testID={`tool-${t.code}`}>
          <View style={s.row}>
            <Text style={s.title}>{t.code} · {t.name}</Text>
            <StatusChip label={t.status} tone={t.status === 'available' ? 'success' : t.status === 'issued' ? 'info' : 'danger'} />
            {t.condition !== 'good' ? <StatusChip label={t.condition.replace('_', ' ')} tone="warning" /> : null}
          </View>
          {t.holder ? <Text style={t.holder.overdue ? s.danger : s.muted}>With {t.holder.name} ({t.holder.kind}) since {formatDate(t.holder.issuedAt)}{t.holder.expectedReturn ? ` · due back ${formatDate(t.holder.expectedReturn)}` : ''}</Text> : null}
          {open === t.id ? (
            <View style={s.list}>
              <ChoiceChips label="Issue to" options={[{ value: 'employee', label: 'Employee' }, { value: 'subcontractor', label: 'Subcontractor' }, { value: 'other', label: 'Other' }]} value={holderKind} onChange={(v) => setHolderKind(v as typeof holderKind)} />
              <TextField label="Name" value={holder} onChangeText={setHolder} testID="tool-holder" />
              <View style={s.row}>
                <Button title="Issue" onPress={() => run(`i-${t.id}`, async () => { await inventoryApi.issueTool(t.id, { holder: { kind: holderKind, name: holder } }); setOpen(''); setHolder(''); })} loading={busy === `i-${t.id}`} testID="tool-issue-save" />
                <Button title="Cancel" variant="ghost" onPress={() => setOpen('')} />
              </View>
            </View>
          ) : (
            <View style={s.row}>
              {t.status === 'available' ? <Button title="Issue" variant="outline" onPress={() => setOpen(t.id)} testID={`tool-issue-${t.code}`} /> : null}
              {t.status === 'issued' ? <><Button title="Returned OK" variant="outline" onPress={() => run(`r-${t.id}`, () => inventoryApi.returnTool(t.id, 'good'))} /><Button title="Returned damaged" variant="ghost" onPress={() => run(`r-${t.id}`, () => inventoryApi.returnTool(t.id, 'damaged'))} /><Button title="Missing" variant="ghost" onPress={() => run(`m-${t.id}`, () => inventoryApi.toolStatus(t.id, 'missing', 'Reported missing from the store screen'))} /></> : null}
              {t.status === 'missing' ? <Button title="Found" variant="ghost" onPress={() => run(`f-${t.id}`, () => inventoryApi.toolStatus(t.id, 'found', 'Found'))} /> : null}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
