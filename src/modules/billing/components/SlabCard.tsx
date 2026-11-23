import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatMoney, formatNumber, parseNumber, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { s } from '../../inventory/ui';
import { pickAttachment } from '../../requisition/components/Attachments';
import { billingApi, type PositionMilestone } from '../billingApi';

type Props = {
  projectId: string; m: PositionMilestone; approved: boolean; busy: string;
  run: (key: string, fn: () => Promise<unknown>) => Promise<boolean>; onInvoice: (id: string) => void;
};

// One payment-term slab: contract %, billed, physical delivery, money still owed in kind (4B),
// the completion record with evidence (4A) and billing it, early or above the position with a reason (Q24).
export function SlabCard({ projectId, m, approved, busy, run, onInvoice }: Props) {
  const computed = m.computedAmount ?? m.unbilled;
  const [amount, setAmount] = useState(String(computed));
  const [reason, setReason] = useState('');
  const [doneOn, setDoneOn] = useState(todayLocal());
  const value = parseNumber(amount) ?? computed;
  const early = m.eligible === false;
  const above = value > computed + 0.005;
  const done = m.completion;
  return (
    <View style={s.card} testID={`slab-pos-${m.name}`}>
      <View style={s.row}>
        <Text style={s.title}>{m.name}{m.contractPct != null ? ` (${m.contractPct}%)` : ''}: {formatMoney(m.amount)}</Text>
        {m.billedAheadOfDelivery ? <StatusChip label="Billed ahead of delivery" tone="warning" /> : null}
        {done ? <StatusChip label={`Complete ${formatDate(done.completedOn)}`} tone="success" /> : null}
      </View>
      <Text style={s.muted}>Billed {formatMoney(m.billed)} · unbilled {formatMoney(m.unbilled)}{m.linkedTotalQty ? ` · delivered ${formatNumber(m.linkedDoneQty)}/${formatNumber(m.linkedTotalQty)} (${m.deliveredPct}%)` : ''}</Text>
      {m.remainingObligation ? <Text style={s.warn} testID={`slab-obligation-${m.name}`}>Remaining obligation: {formatMoney(m.remainingObligation)} billed but not yet delivered</Text> : null}
      {m.pending.map((p) => <Text key={p.serialNo} style={s.warn}>Pending: S.No {p.serialNo} {p.description} — {formatNumber(p.pendingQty)} {p.unit}</Text>)}
      {done ? <Text style={s.muted}>Completion: {done.note || 'recorded'}{done.linkedTotalQty ? ` · ${formatNumber(done.linkedDoneQty ?? 0)}/${formatNumber(done.linkedTotalQty)} done then` : ''} · {done.documentIds.length} evidence file(s)</Text> : null}
      {approved && m.stage !== 'advance' ? (
        <View style={s.row}>
          {!done ? <TextField label="Completed on (YYYY-MM-DD)" value={doneOn} onChangeText={setDoneOn} testID={`slab-done-on-${m.name}`} /> : null}
          {!done ? <Button title="Mark complete" variant="outline" onPress={() => run(`done-${m.id}`, () => billingApi.completeSlab(projectId, m.id, { completedOn: doneOn }))} loading={busy === `done-${m.id}`} testID={`slab-complete-${m.name}`} /> : null}
          {done ? <Button title="Attach evidence" variant="ghost" onPress={() => run(`ev-${m.id}`, async () => { const f = await pickAttachment(); if (f) await billingApi.addSlabEvidence(projectId, m.id, f); })} loading={busy === `ev-${m.id}`} testID={`slab-evidence-${m.name}`} /> : null}
        </View>
      ) : null}
      {approved && m.unbilled > 0 ? (
        <View style={s.form}>
          {early ? <Text style={s.warn} testID={`slab-early-${m.name}`}>Not marked complete: billing now is early billing. It needs a reason and approval (Accounts → Director); the invoice stays a draft until approved.</Text> : null}
          {above ? <Text style={s.warn} testID={`slab-above-${m.name}`}>{formatMoney(value)} is more than the {formatMoney(computed)} the delivered quantity supports. The reason is kept as an override record.</Text> : null}
          <View style={s.row}>
            <TextField label="Bill amount ₹" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID={`slab-amount-${m.name}`} />
            {early || above ? <View style={s.cell}><TextField label="Reason" value={reason} onChangeText={setReason} testID={`slab-reason-${m.name}`} /></View> : null}
            <Button title="Raise invoice" onPress={() => run(`inv-${m.id}`, async () => { const x = await billingApi.milestoneInvoice(projectId, { milestoneId: m.id, invoiceDate: todayLocal(), amount: Math.abs(value - computed) < 0.005 ? undefined : value, reason: reason.trim() || undefined }); onInvoice(x.id); })} loading={busy === `inv-${m.id}`} testID={`slab-bill-${m.name}`} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
