import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import type { ProcurementPo, SupplierInvoice } from '../types';
import { Section, errorText, styles } from '../ui';

const r2 = (n: number) => Math.round(n * 100) / 100;

// Books a supplier invoice against this PO and its checked-in lots; the server runs the three-way match.
export function SupplierInvoiceForm({ po, onSaved, onCancel }: { po: ProcurementPo; onSaved: (inv: SupplierInvoice) => void; onCancel: () => void }) {
  const received = po.lots.filter((l) => l.receivedAt);
  const [lotIds, setLotIds] = useState<string[]>(received.map((l) => l.id));
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [gstin, setGstin] = useState('');
  const [other, setOther] = useState('');
  const [total, setTotal] = useState('');
  const [lines, setLines] = useState<Record<string, { qty: string; rate: string; tax: string }>>(Object.fromEntries(po.lines.map((l) => [l.id, { qty: String(l.delivery.accepted), rate: String(l.rate), tax: String(l.taxPercent) }])));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (id: string, k: 'qty' | 'rate' | 'tax') => (v: string) => setLines((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const priced = useMemo(() => po.lines.map((l) => ({ poLineId: l.id, qty: parseNumber(lines[l.id].qty) ?? 0, rate: parseNumber(lines[l.id].rate) ?? 0, taxPercent: parseNumber(lines[l.id].tax) ?? 0 })).filter((l) => l.qty > 0), [lines, po.lines]);
  const taxable = r2(priced.reduce((s, l) => s + l.qty * l.rate, 0));
  const gst = r2(priced.reduce((s, l) => s + (l.qty * l.rate * l.taxPercent) / 100, 0));
  const igstMode = po.igst > 0;
  const computedTotal = r2(taxable + gst + (parseNumber(other) ?? 0));

  const save = async () => {
    if (!number.trim()) return setProblem('Enter the supplier invoice number');
    if (!priced.length) return setProblem('Enter the invoiced quantity for at least one item');
    setBusy(true); setProblem('');
    try {
      const half = r2(gst / 2);
      const inv = await procurementApi.createInvoice({
        purchaseOrderId: po.id, lotIds, number: number.trim(), invoiceDate: date, supplierGstin: gstin.trim() || undefined, lines: priced, taxable,
        ...(igstMode ? { igst: gst } : { cgst: half, sgst: r2(gst - half) }), other: parseNumber(other) ?? 0, total: parseNumber(total) ?? computedTotal,
      });
      onSaved(inv);
    } catch (e) { setProblem(errorText(e)); setBusy(false); }
  };

  return (
    <Section title="Book supplier invoice" testID="sinv-form">
      {problem ? <ErrorBanner message={problem} testID="sinv-form-problem" /> : null}
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Invoice number" value={number} onChangeText={setNumber} testID="sinv-number" /></View>
        <View style={styles.cell}><TextField label="Invoice date (YYYY-MM-DD)" value={date} onChangeText={setDate} /></View>
        <View style={styles.cell}><TextField label="Supplier GSTIN on invoice" value={gstin} onChangeText={setGstin} autoCapitalize="characters" /></View>
      </View>
      <Text style={styles.title}>Goods receipts covered</Text>
      <View style={styles.row}>
        {received.length === 0 ? <Text style={styles.warn}>No lot on this PO has been checked in yet — the invoice will be flagged.</Text> : null}
        {received.map((l) => {
          const on = lotIds.includes(l.id);
          return <Pressable key={l.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setLotIds((s) => (on ? s.filter((x) => x !== l.id) : [...s, l.id]))} style={styles.card}><Text style={styles.title}>{on ? '✓ ' : ''}Lot {l.lotNo} · {l.challanNo}</Text></Pressable>;
        })}
      </View>
      {po.lines.map((l) => (
        <View key={l.id} style={styles.row}>
          <Text style={[styles.title, styles.cell]}>S.No {l.serialNo} {l.description} (accepted {l.delivery.accepted} {l.unit})</Text>
          <TextField label="Qty billed" value={lines[l.id].qty} onChangeText={set(l.id, 'qty')} keyboardType="decimal-pad" testID={`sinv-qty-${l.serialNo}`} />
          <TextField label="Rate ₹" value={lines[l.id].rate} onChangeText={set(l.id, 'rate')} keyboardType="decimal-pad" testID={`sinv-rate-${l.serialNo}`} />
          <TextField label="GST %" value={lines[l.id].tax} onChangeText={set(l.id, 'tax')} keyboardType="decimal-pad" />
        </View>
      ))}
      <Text style={styles.muted}>Taxable {formatMoney(taxable)} · {igstMode ? `IGST ${formatMoney(gst)}` : `CGST + SGST ${formatMoney(gst)}`} · computed total {formatMoney(computedTotal)}</Text>
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Other charges ₹" value={other} onChangeText={setOther} keyboardType="decimal-pad" /></View>
        <View style={styles.cell}><TextField label="Invoice total as printed ₹" value={total} onChangeText={setTotal} placeholder={String(computedTotal)} keyboardType="decimal-pad" testID="sinv-total" /></View>
      </View>
      <View style={styles.row}><Button title="Submit invoice" onPress={save} loading={busy} testID="sinv-save" /><Button title="Cancel" variant="ghost" onPress={onCancel} /></View>
    </Section>
  );
}
