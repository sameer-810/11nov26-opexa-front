import { useState } from 'react';
import { Text, View } from 'react-native';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import type { Rfq } from '../types';
import { Section, errorText, styles } from '../ui';

type LineInput = { qty: string; rate: string; tax: string; disc: string };

// Buyer keys in a quotation received by email/phone. Same validation as the supplier portal.
export function QuoteForm({ rfq, onSaved, onCancel }: { rfq: Rfq; onSaved: () => void; onCancel: () => void }) {
  const [vendorId, setVendorId] = useState(rfq.suppliers[0]?.vendorId ?? '');
  const [number, setNumber] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [freight, setFreight] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [lines, setLines] = useState<Record<string, LineInput>>(Object.fromEntries(rfq.lines.map((l) => [l.requisitionLineId, { qty: String(l.qty), rate: '', tax: '18', disc: '' }])));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const setLine = (id: string, k: keyof LineInput) => (v: string) => setLines((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const save = async () => {
    setProblem('');
    const priced = rfq.lines.filter((l) => parseNumber(lines[l.requisitionLineId].rate) !== null).map((l) => {
      const x = lines[l.requisitionLineId];
      return { requisitionLineId: l.requisitionLineId, qty: parseNumber(x.qty) ?? 0, rate: parseNumber(x.rate) ?? 0, taxPercent: parseNumber(x.tax) ?? 0, discount: parseNumber(x.disc) ?? 0 };
    });
    if (!number.trim()) return setProblem('Enter the quotation number');
    if (!priced.length) return setProblem('Enter a rate for at least one item');
    setBusy(true);
    try {
      await procurementApi.addQuote(rfq.id, { vendorId, number: number.trim(), lines: priced, freight: parseNumber(freight) ?? 0, deliveryDays: parseNumber(deliveryDays) ?? undefined, paymentTerms, validUntil: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : undefined });
      onSaved();
    } catch (e) { setProblem(errorText(e)); setBusy(false); }
  };

  return (
    <Section title="Record a quotation" testID="quote-form">
      {problem ? <ErrorBanner message={problem} /> : null}
      <ChoiceChips label="Supplier" options={rfq.suppliers.map((s) => ({ value: s.vendorId, label: s.vendorName ?? '' }))} value={vendorId} onChange={setVendorId} testID="qf-vendor" />
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Quotation number" value={number} onChangeText={setNumber} testID="qf-number" /></View>
        <View style={styles.cell}><TextField label="Valid until (YYYY-MM-DD)" value={validUntil} onChangeText={setValidUntil} /></View>
        <View style={styles.cell}><TextField label="Delivery (days)" value={deliveryDays} onChangeText={setDeliveryDays} keyboardType="number-pad" /></View>
        <View style={styles.cell}><TextField label="Freight (₹)" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" /></View>
      </View>
      <TextField label="Payment terms" value={paymentTerms} onChangeText={setPaymentTerms} />
      {rfq.lines.map((l) => (
        <View key={l.requisitionLineId} style={styles.row}>
          <Text style={[styles.title, styles.cell]}>S.No {l.serialNo} {l.description} ({l.qty} {l.unit})</Text>
          <TextField label="Qty" value={lines[l.requisitionLineId].qty} onChangeText={setLine(l.requisitionLineId, 'qty')} keyboardType="decimal-pad" />
          <TextField label="Rate ₹" value={lines[l.requisitionLineId].rate} onChangeText={setLine(l.requisitionLineId, 'rate')} keyboardType="decimal-pad" testID={`qf-rate-${l.serialNo}`} />
          <TextField label="Discount ₹" value={lines[l.requisitionLineId].disc} onChangeText={setLine(l.requisitionLineId, 'disc')} keyboardType="decimal-pad" />
          <TextField label="GST %" value={lines[l.requisitionLineId].tax} onChangeText={setLine(l.requisitionLineId, 'tax')} keyboardType="decimal-pad" />
        </View>
      ))}
      <View style={styles.row}>
        <Button title="Save quotation" onPress={save} loading={busy} testID="qf-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Section>
  );
}
