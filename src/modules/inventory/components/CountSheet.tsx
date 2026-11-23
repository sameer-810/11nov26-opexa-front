import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { saveBlob } from '../../../shared/download';
import { formatDate, formatMoney, formatNumber, parseNumber } from '../../../shared/format';
import { can, PERMS } from '../../../shared/permissions';
import { useAuth } from '../../../shared/store/useAuthStore';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import type { CountLine, StockCount } from '../types';
import { s, useAction, useData } from '../ui';

export const COUNT_STATUS: Record<StockCount['status'], { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  open: { label: 'Counting', tone: 'info' }, submitted: { label: 'Waiting for approval', tone: 'warning' }, approved: { label: 'Approved, posted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' }, completed: { label: 'Matched the books', tone: 'success' }, cancelled: { label: 'Cancelled', tone: 'neutral' },
};
type Entry = { counted: string; damaged: string; reason: string };
const entryOf = (l: CountLine): Entry => ({ counted: l.countedQty === null ? '' : String(l.countedQty), damaged: l.damagedQty ? String(l.damagedQty) : '', reason: l.reason });

// One count: enter counted (and damaged found) quantities, see the variance, submit; approver decides here too.
export function CountSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const fetcher = useCallback(() => inventoryApi.count(id), [id]);
  const { data: c, error, reload } = useData(fetcher);
  const [edits, setEdits] = useState<Record<string, Entry>>({});
  const [reason, setReason] = useState('');
  const { busy, problem, run, setProblem } = useAction(() => { setEdits({}); void reload(); });

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!c) return <ActivityIndicator />;
  const open = c.status === 'open';
  const decider = can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.SETTINGS_MANAGE);
  const entry = (l: CountLine) => edits[l.id] ?? entryOf(l);
  const set = (l: CountLine, patch: Partial<Entry>) => setEdits((e) => ({ ...e, [l.id]: { ...entry(l), ...patch } }));

  const save = () => {
    const lines: { materialId: string; countedQty: number; damagedQty?: number; reason?: string }[] = [];
    for (const l of c.lines.filter((x) => edits[x.id])) {
      const e = edits[l.id];
      const counted = parseNumber(e.counted);
      const damaged = e.damaged.trim() ? parseNumber(e.damaged) : 0;
      if (counted === null || counted < 0 || damaged === null || damaged < 0) return setProblem(`${l.name}: enter the quantity counted`);
      lines.push({ materialId: l.materialId, countedQty: counted, damagedQty: damaged || undefined, reason: e.reason.trim() || undefined });
    }
    if (!lines.length) return setProblem('Enter at least one counted quantity');
    return run('save', () => inventoryApi.saveCount(c.id, lines));
  };
  const download = async () => {
    try { if (!saveBlob(await inventoryApi.countExcel(c.id), `${c.number}-variance.xlsx`)) setProblem('Open this on the web to download the report.'); } catch { setProblem('Could not download the report'); }
  };

  return (
    <View style={s.list} testID="count-sheet">
      {problem ? <ErrorBanner message={problem} testID="count-problem" /> : null}
      <View style={s.row}>
        <Button title="Back to counts" variant="ghost" onPress={onClose} testID="count-back" />
        <Text style={s.number}>{c.number}</Text>
        <Text style={s.title}>{c.location.name}</Text>
        <StatusChip label={COUNT_STATUS[c.status].label} tone={COUNT_STATUS[c.status].tone} testID="count-status" />
      </View>
      <Text style={s.muted}>{formatDate(c.countDate)} · counted by {c.countedBy.name}{c.scope.type === 'category' ? ` · category ${c.scope.category}` : ''}</Text>
      <Text style={s.title} testID="count-totals">Short {formatMoney(-c.totals.shortValue)} · excess {formatMoney(c.totals.excessValue)} · net {formatMoney(c.totals.netValue)}{c.totals.damagedValue ? ` · damaged found ${formatMoney(c.totals.damagedValue)}` : ''}</Text>
      {c.lines.map((l) => (
        <View key={l.id} style={s.card} testID={`count-line-${l.code}`}>
          <Text style={s.title}>{l.name}</Text>
          <Text style={s.muted}>System {formatNumber(l.systemQty)} {l.unit} @ {formatMoney(l.rate)}</Text>
          {l.variance !== null ? <Text style={l.variance ? s.warn : s.muted} testID={`count-var-${l.code}`}>Variance {l.variance > 0 ? '+' : ''}{formatNumber(l.variance)} {l.unit} ({formatMoney(l.varianceValue ?? 0)}){l.damagedQty ? ` · ${formatNumber(l.damagedQty)} found damaged` : ''}</Text> : null}
          {open ? (
            <View style={s.row}>
              <View style={s.cell}><TextField label={`Counted good (${l.unit})`} value={entry(l).counted} onChangeText={(v) => set(l, { counted: v })} keyboardType="decimal-pad" testID={`count-qty-${l.code}`} /></View>
              {c.location.kind === 'warehouse' ? <View style={s.cell}><TextField label="Found damaged" value={entry(l).damaged} onChangeText={(v) => set(l, { damaged: v })} keyboardType="decimal-pad" testID={`count-dmg-${l.code}`} /></View> : null}
              <View style={s.cell}><TextField label="Reason for difference" value={entry(l).reason} onChangeText={(v) => set(l, { reason: v })} maxLength={200} /></View>
            </View>
          ) : null}
        </View>
      ))}
      {open ? (
        <View style={s.row}>
          <Button title="Save counts" variant="outline" onPress={() => void save()} loading={busy === 'save'} testID="count-save" />
          <Button title="Submit for approval" onPress={() => void run('submit', () => inventoryApi.submitCount(c.id))} disabled={Object.keys(edits).length > 0} loading={busy === 'submit'} testID="count-submit" />
          <View style={s.cell}><TextField label="Reason to cancel" value={reason} onChangeText={setReason} maxLength={300} /></View>
          <Button title="Cancel count" variant="ghost" onPress={() => (reason.trim().length < 3 ? setProblem('Give the reason for cancelling') : void run('cancel', () => inventoryApi.cancelCount(c.id, reason.trim())))} />
        </View>
      ) : null}
      {c.status === 'submitted' && c.adjustmentId && decider ? (
        <View style={s.row}>
          <Text style={s.muted}>Approving posts the differences to stock and moves damaged found to the damaged area.</Text>
          <Button title="Approve" onPress={() => void run('approve', () => inventoryApi.decideAdjustment(c.adjustmentId ?? '', 'approved'))} loading={busy === 'approve'} testID="count-approve" />
          <Button title="Reject" variant="ghost" onPress={() => void run('reject', () => inventoryApi.decideAdjustment(c.adjustmentId ?? '', 'rejected'))} testID="count-reject" />
        </View>
      ) : null}
      <Button title="Download variance report (Excel)" variant="ghost" onPress={() => void download()} testID="count-excel" style={s.self} />
    </View>
  );
}
