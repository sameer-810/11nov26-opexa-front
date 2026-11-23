import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { errText, s } from '../../inventory/ui';
import { MODE_LABEL, supplierPaymentApi, type OpenInvoice, type PaymentInput, type SupplierPaymentMode } from '../supplierPaymentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierPaymentForm'>;
const MODES = (Object.keys(MODE_LABEL) as SupplierPaymentMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }));
const round = (n: number) => Math.round(n * 100) / 100;

// Pick the supplier, see its approved unpaid invoices with what each may be paid for (never more than was
// received and accepted), allocate the payment; anything not allocated is recorded as an advance.
export function SupplierPaymentFormScreen({ navigation, route }: Props) {
  const editId = route.params?.id;
  const [vendors, setVendors] = useState<{ id: string; name: string }[] | null>(null);
  const [find, setFind] = useState('');
  const [vendorId, setVendorId] = useState(route.params?.vendorId ?? '');
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [own, setOwn] = useState<Record<string, number>>({}); // this payment's own allocations when editing
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [tds, setTds] = useState('');
  const [mode, setMode] = useState<SupplierPaymentMode>('bank');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { supplierPaymentApi.vendorNames().then(setVendors).catch((e: unknown) => setProblem(errText(e))); }, []);
  useEffect(() => {
    if (!editId) return;
    supplierPaymentApi.get(editId).then((p) => {
      setVendorId(p.vendor?.id ?? '');
      setOwn(Object.fromEntries(p.allocations.map((a) => [a.supplierInvoiceId, a.amount])));
      setAlloc(Object.fromEntries(p.allocations.map((a) => [a.supplierInvoiceId, String(a.amount)])));
      setAmount(String(p.amount)); setTds(p.tds ? String(p.tds) : ''); setMode(p.mode); setReference(p.reference); setDate(p.date.slice(0, 10)); setRemarks(p.remarks);
    }).catch((e: unknown) => setProblem(errText(e)));
  }, [editId]);
  const loadInvoices = useCallback(async (id: string) => {
    setInvoices(null);
    if (!id) return;
    try { setInvoices(await supplierPaymentApi.openInvoices(id)); } catch (e) { setProblem(errText(e)); }
  }, []);
  useEffect(() => { void loadInvoices(vendorId); }, [vendorId, loadInvoices]);

  const canPayNow = (i: OpenInvoice) => round(i.payableNow + (own[i.id] ?? 0));
  const rows = (invoices ?? []).filter((i) => canPayNow(i) > 0 || own[i.id]);
  const paid = parseNumber(amount) ?? 0;
  const tdsValue = parseNumber(tds) ?? 0;
  const allocated = round(rows.reduce((t, i) => t + (parseNumber(alloc[i.id] ?? '') ?? 0), 0));
  const advance = round(paid + tdsValue - allocated);

  const validate = (): string => {
    if (!vendorId) return 'Choose the supplier';
    if (!(paid > 0)) return 'Enter the amount paid';
    if (tdsValue < 0) return 'TDS cannot be negative';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter the payment date as YYYY-MM-DD';
    for (const i of rows) {
      const v = parseNumber(alloc[i.id] ?? '');
      if (v !== null && (v < 0 || v > canPayNow(i) + 0.005)) return `Invoice ${i.number}: at most ${formatMoney(canPayNow(i))} can be paid now`;
    }
    if (advance < -0.005) return 'The invoices add up to more than the payment plus TDS';
    return '';
  };

  const save = async (submit: boolean) => {
    const bad = validate();
    if (bad) return setProblem(bad);
    const body: PaymentInput = {
      vendorId, date, mode, reference: reference.trim() || undefined, amount: paid, tds: tdsValue || undefined, remarks: remarks.trim() || undefined,
      allocations: rows.map((i) => ({ supplierInvoiceId: i.id, amount: parseNumber(alloc[i.id] ?? '') ?? 0 })).filter((a) => a.amount > 0),
    };
    setBusy(submit ? 'submit' : 'save'); setProblem('');
    try {
      const p = editId ? await supplierPaymentApi.update(editId, body) : await supplierPaymentApi.create(body);
      if (submit) await supplierPaymentApi.submit(p.id);
      navigation.navigate('SupplierPaymentDetail', { id: p.id });
    } catch (e) { setProblem(errText(e)); } finally { setBusy(''); }
  };

  const shown = (vendors ?? []).filter((v) => !find.trim() || v.name.toLowerCase().includes(find.trim().toLowerCase()) || v.id === vendorId).slice(0, 30);
  return (
    <AppScreen title={editId ? 'Edit supplier payment' : 'New supplier payment'} onBack={() => navigation.navigate('Payables')} testID="supplier-payment-form">
      {problem ? <ErrorBanner message={problem} testID="spay-problem" /> : null}
      {!vendors ? <ActivityIndicator /> : null}
      {!editId ? <TextField label="Find supplier" value={find} onChangeText={setFind} testID="spay-find" /> : null}
      <ChoiceChips label="Supplier" value={vendorId} onChange={(v) => { if (!editId) { setVendorId(v); setAlloc({}); } }} options={shown.map((v) => ({ value: v.id, label: v.name }))} testID="spay-vendor" />
      {vendorId && !invoices ? <ActivityIndicator /> : null}
      {invoices && rows.length === 0 ? <EmptyState title="No approved invoices to pay" body="The whole amount will be recorded as an advance on account." /> : null}
      <View style={s.list}>
        {rows.map((i) => (
          <View key={i.id} style={s.card} testID={`spay-inv-${i.number}`}>
            <Text style={s.title}>{i.number} · {formatDate(i.invoiceDate)} · total {formatMoney(i.total)}</Text>
            <Text style={s.muted}>Outstanding {formatMoney(i.outstanding)} · can pay now {formatMoney(canPayNow(i))}{i.inProcess - (own[i.id] ?? 0) > 0 ? ` · ${formatMoney(i.inProcess - (own[i.id] ?? 0))} in other payments` : ''}</Text>
            {i.heldForShortDelivery > 0 ? <Text style={s.warn} testID={`spay-held-${i.number}`}>{formatMoney(i.heldForShortDelivery)} held: billed for quantity not received or accepted</Text> : null}
            {i.daysOverdue > 0 ? <Text style={s.danger}>Overdue by {i.daysOverdue} days</Text> : null}
            <View style={s.row}>
              <View style={s.cell}><TextField label="Pay against this invoice (₹)" value={alloc[i.id] ?? ''} onChangeText={(v) => setAlloc((a) => ({ ...a, [i.id]: v }))} keyboardType="decimal-pad" testID={`spay-alloc-${i.number}`} /></View>
              <Button title="Full" variant="ghost" onPress={() => setAlloc((a) => ({ ...a, [i.id]: String(canPayNow(i)) }))} testID={`spay-full-${i.number}`} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="Amount paid (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="spay-amount" /></View>
          <View style={s.cell}><TextField label="TDS deducted (₹)" value={tds} onChangeText={setTds} keyboardType="decimal-pad" testID="spay-tds" /></View>
          <View style={s.cell}><TextField label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="spay-date" /></View>
        </View>
        <ChoiceChips label="Paid by" value={mode} onChange={(v) => setMode(v as SupplierPaymentMode)} options={MODES} testID="spay-mode" />
        <TextField label={mode === 'cash' ? 'Reference (optional)' : 'UTR / cheque / UPI reference'} value={reference} onChangeText={setReference} maxLength={80} testID="spay-reference" />
        <TextField label="Remarks" value={remarks} onChangeText={setRemarks} maxLength={1000} testID="spay-remarks" />
        <Text style={s.title} testID="spay-summary">Against invoices {formatMoney(allocated)} · payment + TDS {formatMoney(round(paid + tdsValue))}</Text>
        {advance > 0.005 ? <Text style={s.warn} testID="spay-advance">{formatMoney(advance)} will be an advance on account, to adjust against invoices later</Text> : null}
        <View style={s.row}>
          <Button title="Submit for approval" onPress={() => void save(true)} loading={busy === 'submit'} testID="spay-submit" />
          <Button title="Save draft" variant="outline" onPress={() => void save(false)} loading={busy === 'save'} testID="spay-save" />
        </View>
      </View>
    </AppScreen>
  );
}
