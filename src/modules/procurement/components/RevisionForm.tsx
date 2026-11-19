import { useState } from 'react';
import { Text, View } from 'react-native';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import type { ProcurementPo, RevisionInput } from '../types';
import { Section, errorText, styles } from '../ui';

// Controlled PO change: only the edited values are sent; the server keeps the previous version.
export function RevisionForm({ po, onSaved, onCancel }: { po: ProcurementPo; onSaved: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [expected, setExpected] = useState('');
  const [lines, setLines] = useState<Record<string, { qty: string; rate: string; tax: string }>>(Object.fromEntries(po.lines.map((l) => [l.id, { qty: String(l.qty), rate: String(l.rate), tax: String(l.taxPercent) }])));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (id: string, k: 'qty' | 'rate' | 'tax') => (v: string) => setLines((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const save = async () => {
    if (reason.trim().length < 5) return setProblem('Give the reason for the revision');
    const changed: NonNullable<RevisionInput['lines']> = [];
    for (const l of po.lines) {
      const x = lines[l.id];
      const c: NonNullable<RevisionInput['lines']>[number] = { poLineId: l.id };
      const q = parseNumber(x.qty); const r = parseNumber(x.rate); const t = parseNumber(x.tax);
      if (q !== null && q !== l.qty) c.qty = q;
      if (r !== null && r !== l.rate) c.rate = r;
      if (t !== null && t !== l.taxPercent) c.taxPercent = t;
      if (Object.keys(c).length > 1) changed.push(c);
    }
    const body: RevisionInput = { reason: reason.trim(), ...(changed.length ? { lines: changed } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(expected) ? { expectedDate: expected } : {}) };
    setBusy(true); setProblem('');
    try { await procurementApi.revise(po.id, body); onSaved(); } catch (e) { setProblem(errorText(e)); setBusy(false); }
  };

  return (
    <Section title={`Revise ${po.number} (Rev ${po.revision + 1})`} testID="revision-form">
      {problem ? <ErrorBanner message={problem} testID="rev-problem" /> : null}
      <TextField label="Reason for revision" value={reason} onChangeText={setReason} testID="rev-reason" />
      <TextField label="New expected date (YYYY-MM-DD, optional)" value={expected} onChangeText={setExpected} />
      {po.lines.map((l) => (
        <View key={l.id} style={styles.row}>
          <Text style={[styles.title, styles.cell]}>S.No {l.serialNo} {l.description} (sent so far {l.delivery.sent} {l.unit})</Text>
          <TextField label="Qty" value={lines[l.id].qty} onChangeText={set(l.id, 'qty')} keyboardType="decimal-pad" testID={`rev-qty-${l.serialNo}`} />
          <TextField label="Rate ₹" value={lines[l.id].rate} onChangeText={set(l.id, 'rate')} keyboardType="decimal-pad" testID={`rev-rate-${l.serialNo}`} />
          <TextField label="GST %" value={lines[l.id].tax} onChangeText={set(l.id, 'tax')} keyboardType="decimal-pad" />
        </View>
      ))}
      <View style={styles.row}><Button title="Submit revision" onPress={save} loading={busy} testID="rev-save" /><Button title="Cancel" variant="ghost" onPress={onCancel} /></View>
    </Section>
  );
}
