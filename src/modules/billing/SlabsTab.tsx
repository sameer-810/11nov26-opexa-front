import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoney, formatNumber, parseNumber, todayLocal } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { colors } from '../../shared/designSystem';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { billingApi } from './billingApi';

type Draft = { name: string; basis: 'percent' | 'fixed'; value: string };
const DEFAULT: Draft[] = [{ name: 'Advance', basis: 'percent', value: '10' }, { name: 'High-side delivery', basis: 'percent', value: '30' }, { name: 'Installation', basis: 'percent', value: '40' }, { name: 'Testing & commissioning', basis: 'percent', value: '10' }, { name: 'Handover', basis: 'percent', value: '10' }];

// Payment-term slabs: set up (draft), approve, then bill each slab; the true delivery position stays visible.
export function SlabsTab({ projectId, onInvoice }: { projectId: string; onInvoice: (id: string) => void }) {
  const fetcher = useCallback(async () => ({ plan: await billingApi.plan(projectId), position: await billingApi.position(projectId), boq: await projectApi.boq(projectId) }), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [highSide, setHighSide] = useState<string[] | null>(null);
  const [retention, setRetention] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const plan = data.plan;
  const rows = draft ?? (plan ? plan.milestones.map((m) => ({ name: m.name, basis: m.basis, value: String(m.basis === 'percent' ? m.percent : m.fixedAmount) })) : DEFAULT);
  const hs = highSide ?? data.boq.filter((i) => plan?.milestones.some((m) => m.linkedItemIds.includes(i.id))).map((i) => i.id);
  const editable = !plan || plan.status === 'draft';
  const save = () => run('save', () => billingApi.savePlan(projectId, {
    retentionPct: parseNumber(retention) ?? plan?.retentionPct ?? 0, highSideItemIds: hs,
    milestones: rows.map((r) => ({ name: r.name, basis: r.basis, percent: r.basis === 'percent' ? parseNumber(r.value) ?? 0 : 0, fixedAmount: r.basis === 'fixed' ? parseNumber(r.value) ?? 0 : 0, linkedItemIds: /delivery/i.test(r.name) ? hs : [] })),
  }));

  return (
    <View style={s.list} testID="slabs-tab">
      {problem ? <ErrorBanner message={problem} testID="slab-problem" /> : null}
      <View style={s.row}><StatusChip label={plan ? `Plan ${plan.status}` : 'No billing plan'} tone={plan?.status === 'approved' ? 'success' : 'warning'} /><Text style={s.muted}>High-side value {formatMoney(data.position.highSideValue)}</Text></View>
      {editable ? (
        <View style={s.form}>
          <Text style={s.title}>Payment terms</Text>
          {rows.map((r, i) => (
            <View key={`${i}`} style={s.row}>
              <View style={s.cell}><TextField label="Slab" value={r.name} onChangeText={(v) => setDraft(rows.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></View>
              <TextField label={r.basis === 'percent' ? '% of high-side' : 'Fixed ₹'} value={r.value} onChangeText={(v) => setDraft(rows.map((x, j) => (j === i ? { ...x, value: v } : x)))} keyboardType="decimal-pad" testID={`slab-${i}`} />
              <Button title={r.basis === 'percent' ? 'Use fixed ₹' : 'Use %'} variant="ghost" onPress={() => setDraft(rows.map((x, j) => (j === i ? { ...x, basis: x.basis === 'percent' ? 'fixed' : 'percent' } : x)))} />
            </View>
          ))}
          <TextField label="Retention %" value={retention || String(plan?.retentionPct ?? '')} onChangeText={setRetention} keyboardType="decimal-pad" testID="slab-retention" />
          <Text style={s.muted}>High-side items (billed by these slabs; the rest are billed by measurement):</Text>
          <View style={s.row}>
            {data.boq.map((i) => { const on = hs.includes(i.id); return <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setHighSide(on ? hs.filter((x) => x !== i.id) : [...hs, i.id])} style={[s.card, on && { borderColor: colors.primary }]} testID={`hs-${i.serialNo}`}><Text style={s.title}>{on ? '✓ ' : ''}{i.serialNo} {i.description}</Text></Pressable>; })}
          </View>
          <View style={s.row}>
            <Button title="Save plan" onPress={save} loading={busy === 'save'} testID="slab-save" />
            {plan ? <Button title="Approve plan" variant="outline" onPress={() => run('approve', () => billingApi.approvePlan(projectId))} testID="slab-approve" /> : null}
          </View>
        </View>
      ) : null}
      {data.position.milestones.map((m) => (
        <View key={m.id} style={s.card} testID={`slab-pos-${m.name}`}>
          <View style={s.row}><Text style={s.title}>{m.name}: {formatMoney(m.amount)}</Text>{m.billedAheadOfDelivery ? <StatusChip label="Billed ahead of delivery" tone="warning" /> : null}</View>
          <Text style={s.muted}>Billed {formatMoney(m.billed)} · unbilled {formatMoney(m.unbilled)}{m.linkedTotalQty ? ` · delivered ${formatNumber(m.linkedDoneQty)}/${formatNumber(m.linkedTotalQty)} (${m.deliveredPct}%)` : ''}</Text>
          {m.pending.map((p) => <Text key={p.serialNo} style={s.warn}>Pending: S.No {p.serialNo} {p.description} — {formatNumber(p.pendingQty)} {p.unit}</Text>)}
          {plan?.status === 'approved' && m.unbilled > 0 ? (
            <View style={s.row}>
              <TextField label="Bill amount ₹" value={amounts[m.id] ?? String(m.unbilled)} onChangeText={(v) => setAmounts((x) => ({ ...x, [m.id]: v }))} keyboardType="decimal-pad" testID={`slab-amount-${m.name}`} />
              <Button title="Raise invoice" onPress={() => run(`inv-${m.id}`, async () => { const amount = parseNumber(amounts[m.id] ?? '') ?? undefined; const x = await billingApi.milestoneInvoice(projectId, { milestoneId: m.id, invoiceDate: todayLocal(), amount: amount === m.unbilled ? undefined : amount }); onInvoice(x.id); })} loading={busy === `inv-${m.id}`} testID={`slab-bill-${m.name}`} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
