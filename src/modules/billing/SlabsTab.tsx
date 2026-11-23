import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoney, parseNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { colors } from '../../shared/designSystem';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, PERMS } from '../../shared/permissions';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { billingApi, type SlabBase, type Stage } from './billingApi';
import { SlabCard } from './components/SlabCard';

type Draft = { id?: string; name: string; stage: Stage; basis: 'percent' | 'fixed'; value: string };
const DEFAULT: Draft[] = [
  { name: 'Advance', stage: 'advance', basis: 'percent', value: '10' }, { name: 'High-side delivery', stage: 'high_side_delivery', basis: 'percent', value: '30' },
  { name: 'Installation', stage: 'installation', basis: 'percent', value: '40' }, { name: 'Testing & commissioning', stage: 'testing_commissioning', basis: 'percent', value: '10' }, { name: 'Handover', stage: 'handover', basis: 'percent', value: '10' },
];
const BASE_LABEL: Record<SlabBase, string> = { contract_value: 'contract value', high_side_value: 'high-side value' };

// Payment-term slabs: set up (draft), approve, then bill each slab; the true delivery position stays visible.
export function SlabsTab({ projectId, onInvoice }: { projectId: string; onInvoice: (id: string) => void }) {
  const fetcher = useCallback(async () => ({ plan: await billingApi.plan(projectId), position: await billingApi.position(projectId), boq: await projectApi.boq(projectId) }), [projectId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [highSide, setHighSide] = useState<string[] | null>(null);
  const [retention, setRetention] = useState('');
  const [base, setBase] = useState<SlabBase | null>(null);
  const [recovery, setRecovery] = useState('');
  const [reason, setReason] = useState('');
  const [changing, setChanging] = useState(false);
  const md = can(useAuth().user, PERMS.INVOICE_EDIT);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const plan = data.plan;
  const rows = draft ?? (plan ? plan.milestones.map((m) => ({ id: m.id, name: m.name, stage: m.stage, basis: m.basis, value: String(m.basis === 'percent' ? m.percent : m.fixedAmount) })) : DEFAULT);
  const hs = highSide ?? plan?.highSideItemIds ?? data.boq.filter((i) => plan?.milestones.some((m) => m.linkedItemIds.includes(i.id))).map((i) => i.id);
  const slabBase = base ?? plan?.slabBase ?? 'contract_value';
  const approved = plan?.status === 'approved';
  // An approved plan changes only with the billing-edit right and a reason; a billed slab keeps its % / amount (and
  // the base, once a % slab is billed). The server enforces the same.
  const editable = !plan || plan.status === 'draft' || (approved && md && changing);
  const billedOf = (id?: string) => plan?.milestones.find((m) => m.id === id)?.billed ?? 0;
  const baseLocked = approved && Boolean(plan?.milestones.some((m) => m.basis === 'percent' && m.billed > 0));
  const save = () => run('save', async () => {
    await billingApi.savePlan(projectId, {
      retentionPct: parseNumber(retention) ?? plan?.retentionPct ?? 0, advanceRecoveryPct: parseNumber(recovery) ?? plan?.advanceRecoveryPct ?? 0, slabBase, highSideItemIds: hs, ...(approved ? { reason: reason.trim() } : {}),
      milestones: rows.map((r) => ({ id: r.id, name: r.name, stage: r.stage, basis: r.basis, percent: r.basis === 'percent' ? parseNumber(r.value) ?? 0 : 0, fixedAmount: r.basis === 'fixed' ? parseNumber(r.value) ?? 0 : 0, linkedItemIds: r.stage === 'high_side_delivery' ? hs : [] })),
    });
    setChanging(false); setDraft(null);
  });
  const pos = data.position;

  return (
    <View style={s.list} testID="slabs-tab">
      {problem ? <ErrorBanner message={problem} testID="slab-problem" /> : null}
      <View style={s.row}>
        <StatusChip label={plan ? `Plan ${plan.status}` : 'No billing plan'} tone={plan?.status === 'approved' ? 'success' : 'warning'} />
        <Text style={s.muted} testID="slab-base-value">{pos.slabBase ? `Slabs on ${BASE_LABEL[pos.slabBase]} ${formatMoney(pos.baseValue ?? 0)} · ` : ''}High-side value {formatMoney(pos.highSideValue)}</Text>
      </View>
      {pos.remainingObligation ? <Text style={s.warn} testID="slab-total-obligation">Remaining obligation (billed, not yet delivered / executed): {formatMoney(pos.remainingObligation)}</Text> : null}
      {approved && md && !changing ? <Button title="Change approved plan" variant="outline" onPress={() => setChanging(true)} style={s.self} testID="slab-change" /> : null}
      {editable ? (
        <View style={s.form}>
          <Text style={s.title}>Payment terms</Text>
          {baseLocked ? <Text style={s.muted}>Percentages apply to the {BASE_LABEL[slabBase]} (locked: a % slab is already billed)</Text> : <ChoiceChips label="Percentages apply to" value={slabBase} onChange={(v) => setBase(v as SlabBase)} options={[{ value: 'contract_value', label: 'Contract value' }, { value: 'high_side_value', label: 'High-side value' }]} testID="slab-base" />}
          {rows.map((r, i) => {
            const locked = approved && billedOf(r.id) > 0;
            return (
              <View key={`${i}`} style={s.row}>
                <View style={s.cell}><TextField label="Slab" value={r.name} onChangeText={(v) => setDraft(rows.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></View>
                <TextField label={`${r.basis === 'percent' ? `% of ${BASE_LABEL[slabBase]}` : 'Fixed ₹'}${locked ? ' (billed: locked)' : ''}`} value={r.value} editable={!locked} onChangeText={(v) => setDraft(rows.map((x, j) => (j === i ? { ...x, value: v } : x)))} keyboardType="decimal-pad" testID={`slab-${i}`} />
                {locked ? <Text style={s.muted}>Billed {formatMoney(billedOf(r.id))}</Text> : <Button title={r.basis === 'percent' ? 'Use fixed ₹' : 'Use %'} variant="ghost" onPress={() => setDraft(rows.map((x, j) => (j === i ? { ...x, basis: x.basis === 'percent' ? 'fixed' : 'percent' } : x)))} />}
              </View>
            );
          })}
          <TextField label="Retention %" value={retention || String(plan?.retentionPct ?? '')} onChangeText={setRetention} keyboardType="decimal-pad" testID="slab-retention" />
          <TextField label="Advance recovery % (of each progress bill, 0 = off)" value={recovery || String(plan?.advanceRecoveryPct ?? '')} onChangeText={setRecovery} keyboardType="decimal-pad" testID="slab-recovery" />
          {approved ? <TextField label="Reason for changing the approved plan" value={reason} onChangeText={setReason} testID="slab-reason" /> : null}
          <Text style={s.muted}>High-side items (billed by these slabs; the rest are billed by measurement):</Text>
          <View style={s.row}>
            {data.boq.map((i) => { const on = hs.includes(i.id); return <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setHighSide(on ? hs.filter((x) => x !== i.id) : [...hs, i.id])} style={[s.card, on && { borderColor: colors.primary }]} testID={`hs-${i.serialNo}`}><Text style={s.title}>{on ? '✓ ' : ''}{i.serialNo} {i.description}</Text></Pressable>; })}
          </View>
          <View style={s.row}>
            <Button title="Save plan" onPress={save} loading={busy === 'save'} testID="slab-save" />
            {plan && !approved ? <Button title="Approve plan" variant="outline" onPress={() => run('approve', () => billingApi.approvePlan(projectId))} testID="slab-approve" /> : null}
            {changing ? <Button title="Keep the plan as it is" variant="ghost" onPress={() => { setChanging(false); setDraft(null); }} /> : null}
          </View>
        </View>
      ) : null}
      {pos.milestones.map((m) => <SlabCard key={m.id} projectId={projectId} m={m} approved={plan?.status === 'approved'} busy={busy} run={run} onInvoice={onInvoice} />)}
    </View>
  );
}
