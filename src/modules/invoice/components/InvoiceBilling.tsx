import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, formatMoney, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { colors, spacing } from '../../../shared/designSystem';
import type { Invoice } from '../invoiceApi';

// Q27: tax per rate. Older invoices show their one rate as a single row.
export function GstSummary({ inv }: { inv: Invoice }) {
  const rows = inv.gstSummary ?? [{ rate: inv.gstRate, taxable: inv.taxable, cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst }];
  return (
    <View testID="inv-gst-summary">
      {rows.map((r) => (
        <View key={r.rate} style={styles.sum}>
          <Text style={styles.text}>GST {r.rate}% on {formatMoney(r.taxable)}</Text>
          <Text style={styles.text}>{inv.interState ? `IGST ${formatMoney(r.igst)}` : `CGST ${formatMoney(r.cgst)} + SGST ${formatMoney(r.sgst)}`}</Text>
        </View>
      ))}
    </View>
  );
}

// 4A / 4B: early-billing status, amount overrides and earlier versions of the invoice.
export function SlabNotes({ inv }: { inv: Invoice }) {
  const eb = inv.earlyBilling;
  return (
    <>
      {eb ? <Text style={eb.status === 'approved' ? styles.muted : styles.warn} testID="inv-early">Billed before the slab was complete ({eb.status.replace('_', ' ')}): “{eb.reason}”{eb.status === 'approved' ? '' : ' — it can be issued once the approval is through.'}</Text> : null}
      {(inv.overrides ?? []).map((o, i) => <Text key={i} style={styles.warn} testID={`inv-override-${i}`}>Override: {formatMoney(o.amount)} billed against {formatMoney(o.computedAmount)} supported by delivery · {o.byName}, {formatDate(o.at)} · “{o.reason}”</Text>)}
      {(inv.revisions ?? []).map((r) => <Text key={r.revision} style={styles.muted} testID={`inv-revision-${r.revision}`}>Revision {r.revision} · {formatDate(r.at)} · “{r.reason}”{r.snapshot?.total !== undefined ? ` · total before ${formatMoney(r.snapshot.total)}` : ''}</Text>)}
    </>
  );
}

// 4B: the MD / accountant changes the slab amount; above the delivered position it needs a reason (kept as an override).
export function SlabAmountEditor({ inv, busy, onSave }: { inv: Invoice; busy: boolean; onSave: (amount: number, reason: string) => void }) {
  const [amount, setAmount] = useState(String(inv.milestoneLine?.amount ?? ''));
  const [reason, setReason] = useState('');
  return (
    <View style={styles.row}>
      <TextField label="Slab amount ₹" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="inv-slab-amount" />
      <View style={styles.cell}><TextField label="Reason (kept in the log)" value={reason} onChangeText={setReason} testID="inv-slab-reason" /></View>
      <Button title="Change amount" variant="outline" onPress={() => onSave(parseNumber(amount) ?? 0, reason.trim())} loading={busy} testID="inv-slab-save" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 180 },
  sum: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
});
