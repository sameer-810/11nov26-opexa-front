import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { s, useAction, useData } from '../../inventory/ui';
import { canPaySuppliers, MODE_LABEL, STATUS_LABEL, statusTone, supplierPaymentApi, type OpenInvoice, type SupplierPaymentMode } from '../supplierPaymentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierPaymentDetail'>;
const MODES = (Object.keys(MODE_LABEL) as SupplierPaymentMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }));

export function SupplierPaymentDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const writes = canPaySuppliers(user);
  const fetcher = useCallback(() => supplierPaymentApi.get(id), [id]);
  const { data: p, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [paidDate, setPaidDate] = useState(todayLocal());
  const [mode, setMode] = useState<SupplierPaymentMode | ''>('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState<OpenInvoice[] | null>(null);
  const [adjust, setAdjust] = useState<Record<string, string>>({});

  if (error) return <AppScreen title="Supplier payment" onBack={() => navigation.navigate('SupplierPayments')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  if (!p) return <AppScreen title="Supplier payment" onBack={() => navigation.navigate('SupplierPayments')}><ActivityIndicator /></AppScreen>;

  const payMode = mode || p.mode;
  const pay = () => {
    const ref = reference.trim() || p.reference;
    if (payMode !== 'cash' && !ref) return setProblem('Enter the bank / cheque / UPI reference');
    return run('pay', () => supplierPaymentApi.pay(p.id, { paidDate, mode: payMode, reference: ref || undefined }));
  };
  const loadOpen = async () => {
    if (!p.vendor) return;
    try { setOpen(await supplierPaymentApi.openInvoices(p.vendor.id)); } catch { setProblem('Could not load the invoices'); }
  };
  const doAdjust = () => {
    const allocations = Object.entries(adjust).map(([supplierInvoiceId, v]) => ({ supplierInvoiceId, amount: parseNumber(v) ?? 0 })).filter((a) => a.amount > 0);
    if (!allocations.length) return setProblem('Enter an amount against at least one invoice');
    return run('adjust', async () => { await supplierPaymentApi.adjust(p.id, allocations); setOpen(null); setAdjust({}); });
  };

  return (
    <AppScreen title={`Payment ${p.number}`} subtitle={p.vendor?.name} onBack={() => navigation.navigate('SupplierPayments')} testID="supplier-payment-detail">
      {problem ? <ErrorBanner message={problem} testID="spay-detail-problem" /> : null}
      <View style={s.row}>
        <StatusChip label={STATUS_LABEL[p.status]} tone={statusTone(p.status)} testID="spay-status" />
        {p.isAdvance && p.status !== 'cancelled' ? <StatusChip label={`Advance ${formatMoney(p.onAccount)} not adjusted`} tone="warning" testID="spay-advance-chip" /> : null}
      </View>
      <View style={s.card}>
        <Text style={s.number}>{formatMoney(p.amount)}{p.tds ? ` + TDS ${formatMoney(p.tds)}` : ''}</Text>
        <Text style={s.muted}>{formatDate(p.date)} · {MODE_LABEL[p.mode]}{p.reference ? ` ${p.reference}` : ''}</Text>
        {p.allocations.map((a) => <Text key={a.supplierInvoiceId} style={s.title}>Invoice {a.invoiceNumber}: {formatMoney(a.amount)}{a.adjustedAt ? ` (advance adjusted ${formatDate(a.adjustedAt)})` : ''}</Text>)}
        {p.remarks ? <Text style={s.muted}>{p.remarks}</Text> : null}
        {p.reviewComment ? <Text style={s.warn} testID="spay-review">Approver: {p.reviewComment}</Text> : null}
        {p.cancelled ? <Text style={s.danger}>Cancelled {formatDate(p.cancelled.at)}: {p.cancelled.reason}</Text> : null}
      </View>
      {writes && ['draft', 'sent_back'].includes(p.status) ? (
        <View style={s.row}>
          <Button title="Submit for approval" onPress={() => void run('submit', () => supplierPaymentApi.submit(p.id))} loading={busy === 'submit'} testID="spay-detail-submit" />
          <Button title="Edit" variant="outline" onPress={() => navigation.navigate('SupplierPaymentForm', { id: p.id })} testID="spay-edit" />
        </View>
      ) : null}
      {writes && p.status === 'approved' ? (
        <View style={s.form} testID="spay-pay-form">
          <ChoiceChips label="Paid by" value={payMode} onChange={(v) => setMode(v as SupplierPaymentMode)} options={MODES} testID="spay-pay-mode" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Paid on (YYYY-MM-DD)" value={paidDate} onChangeText={setPaidDate} testID="spay-paid-date" /></View>
            <View style={s.cell}><TextField label="Reference" value={reference} onChangeText={setReference} placeholder={p.reference} maxLength={80} testID="spay-pay-ref" /></View>
          </View>
          <Button title="Mark paid" onPress={() => void pay()} loading={busy === 'pay'} testID="spay-mark-paid" />
        </View>
      ) : null}
      {writes && p.status === 'paid' && p.isAdvance ? (
        <View style={s.form}>
          <Text style={s.title}>Adjust the advance against invoices</Text>
          {!open ? <Button title="Show unpaid invoices" variant="outline" onPress={() => void loadOpen()} testID="spay-adjust-open" /> : null}
          {open?.filter((i) => i.payableNow > 0).map((i) => (
            <View key={i.id} style={s.row}>
              <Text style={s.muted}>{i.number}: can pay {formatMoney(i.payableNow)}</Text>
              <View style={s.cell}><TextField label="Adjust (₹)" value={adjust[i.id] ?? ''} onChangeText={(v) => setAdjust((a) => ({ ...a, [i.id]: v }))} keyboardType="decimal-pad" testID={`spay-adjust-${i.number}`} /></View>
            </View>
          ))}
          {open ? <Button title="Adjust" onPress={() => void doAdjust()} loading={busy === 'adjust'} testID="spay-adjust-save" /> : null}
        </View>
      ) : null}
      {writes && !['cancelled', 'rejected'].includes(p.status) ? (
        <View style={s.row}>
          <View style={s.cell}><TextField label="Reason to cancel" value={reason} onChangeText={setReason} maxLength={500} testID="spay-cancel-reason" /></View>
          <Button title="Cancel payment" variant="ghost" onPress={() => (reason.trim().length < 3 ? setProblem('Give the reason for cancelling') : void run('cancel', () => supplierPaymentApi.cancel(p.id, reason.trim())))} loading={busy === 'cancel'} testID="spay-cancel" />
        </View>
      ) : null}
    </AppScreen>
  );
}
