import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { inventoryApi } from '../api/inventoryApi';
import type { Tool } from '../types';
import { s, useAction, useData } from '../ui';
import { ToolActionForm, type ToolMode } from './ToolActionForm';
import { ToolHistoryPanel } from './ToolHistoryPanel';

const VIEWS = [{ value: '', label: 'All tools' }, { value: 'service', label: 'Due for service' }];
const STATUS_TONE: Record<Tool['status'], 'success' | 'info' | 'warning' | 'danger'> = { available: 'success', issued: 'info', in_repair: 'warning', missing: 'danger', scrapped: 'danger' };
// What can be done with a tool in each status.
const ACTIONS: Record<Tool['status'], { mode: ToolMode; title: string }[]> = {
  available: [{ mode: 'issue', title: 'Issue' }, { mode: 'repair', title: 'Send for repair' }, { mode: 'service', title: 'Record service' }, { mode: 'damaged', title: 'Damaged' }, { mode: 'missing', title: 'Lost' }],
  issued: [{ mode: 'return', title: 'Return' }, { mode: 'missing', title: 'Lost' }],
  in_repair: [{ mode: 'repaired', title: 'Repaired' }],
  missing: [],
  scrapped: [],
};
// Status and condition chips as people say them.
const LABELS: Record<string, string> = { available: 'Available', issued: 'Issued', in_repair: 'In repair', missing: 'Missing', scrapped: 'Scrapped', good: 'Good', fair: 'Fair', needs_repair: 'Needs repair', damaged: 'Damaged' };
const label = (v: string) => LABELS[v] ?? v.replace(/_/g, ' ');

// Tools and equipment register: issue with condition, return with its date, repair and service records, history.
export function ToolsTab() {
  const [view, setView] = useState('');
  const fetcher = useCallback(async () => {
    const [tools, projects] = await Promise.all([inventoryApi.tools(view === 'service' ? { due: 'service' } : {}), projectApi.list().catch(() => [])]);
    return { tools, projects: projects.filter((p) => p.status !== 'closed').map((p) => ({ value: p.id, label: `${p.code} ${p.name}` })) };
  }, [view]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [open, setOpen] = useState<{ id: string; mode: ToolMode | 'history' } | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const toggle = (id: string, mode: ToolMode | 'history') => setOpen(open?.id === id && open.mode === mode ? null : { id, mode });
  return (
    <View style={s.list} testID="tools-tab">
      {problem ? <ErrorBanner message={problem} testID="tools-problem" /> : null}
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="New tool / equipment" value={name} onChangeText={setName} placeholder="e.g. Hilti drilling machine" testID="tool-name" /></View>
          <View style={s.cell}><TextField label="Serial no. (unique)" value={serial} onChangeText={setSerial} testID="tool-serial" /></View>
        </View>
        <Button title="Add to register" onPress={() => run('add', async () => { await inventoryApi.createTool({ name, serialNo: serial || undefined }); setName(''); setSerial(''); })} loading={busy === 'add'} testID="tool-add" />
      </View>
      <ChoiceChips label="Show" options={VIEWS} value={view} onChange={setView} testID="tools-view" />
      {data?.tools.map((t) => (
        <View key={t.id} style={s.card} testID={`tool-${t.code}`}>
          <View style={s.row}>
            <Text style={s.title}>{t.code} · {t.name}{t.serialNo ? ` · S/N ${t.serialNo}` : ''}</Text>
            <StatusChip label={label(t.status)} tone={STATUS_TONE[t.status]} testID={`tool-status-${t.code}`} />
            {t.condition !== 'good' ? <StatusChip label={label(t.condition)} tone="warning" /> : null}
            {t.serviceDue ? <StatusChip label={`Service due ${formatDate(t.nextServiceDue ?? null)}`} tone="warning" testID={`tool-due-${t.code}`} /> : null}
          </View>
          {t.holder ? <Text style={t.holder.overdue ? s.danger : s.muted}>With {t.holder.name} ({t.holder.kind}) since {formatDate(t.holder.issuedAt)}{t.holder.conditionAtIssue ? `, issued ${label(t.holder.conditionAtIssue).toLowerCase()}` : ''}{t.holder.expectedReturn ? ` · due back ${formatDate(t.holder.expectedReturn)}` : ''}</Text> : null}
          <View style={s.row}>
            {ACTIONS[t.status].filter((a) => !(a.mode === 'issue' && t.condition === 'damaged')).map((a) => (
              <Button key={a.mode} title={a.title} variant={['issue', 'return', 'repaired'].includes(a.mode) ? 'outline' : 'ghost'} onPress={() => toggle(t.id, a.mode)} testID={`tool-${a.mode}-${t.code}`} />
            ))}
            {t.status === 'missing' ? <Button title="Found" variant="ghost" onPress={() => run(`f-${t.id}`, () => inventoryApi.toolStatus(t.id, 'found', 'Found'))} testID={`tool-found-${t.code}`} /> : null}
            <Button title={open?.id === t.id && open.mode === 'history' ? 'Hide history' : 'History'} variant="ghost" onPress={() => toggle(t.id, 'history')} testID={`tool-history-${t.code}`} />
          </View>
          {open?.id === t.id && open.mode === 'history' ? <ToolHistoryPanel id={t.id} /> : null}
          {open?.id === t.id && open.mode !== 'history' ? <ToolActionForm tool={t} mode={open.mode} projects={data.projects} busy={busy} run={run} setProblem={setProblem} onClose={() => setOpen(null)} /> : null}
          {/* Also on the card being acted on: the banner at the top of a long list is out of view. */}
          {open?.id === t.id && open.mode !== 'history' && problem ? <ErrorBanner message={problem} testID={`tool-problem-${t.code}`} /> : null}
        </View>
      ))}
    </View>
  );
}
