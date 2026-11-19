import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import { INVOICE_TONE, label } from '../types';
import { History, Loading, Section, errorText, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierInvoiceDetail'>;
type Action = 'start' | 'rematch' | 'approve' | 'reject' | 'cancel' | 'submit';

export function SupplierInvoiceDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const finance = can(user, PERMS.SUPPLIER_INVOICE_VERIFY);
  const fetcher = useCallback(() => procurementApi.invoice(id), [id]);
  const { data: inv, error, reload, setData } = useLoad(fetcher);
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const act = async (a: Action) => {
    if ((a === 'reject' || a === 'cancel') && remarks.trim().length < 3) return setProblem('Give a reason in the remarks');
    setBusy(a); setProblem('');
    try { setData(await procurementApi.invoiceAction(id, a, remarks.trim() || undefined)); setRemarks(''); } catch (e) { setProblem(errorText(e)); } finally { setBusy(''); }
  };
  const live = inv && !['approved', 'rejected', 'cancelled'].includes(inv.status);

  return (
    <AppScreen title={inv ? `Invoice ${inv.number}` : 'Supplier invoice'} subtitle={inv ? `${inv.vendor?.name} · ${inv.purchaseOrderNumber} · FY ${inv.financialYear}` : ''} onBack={() => navigation.navigate('SupplierInvoices')} testID="sinv-detail"
      right={inv ? <StatusChip label={label(inv.status)} tone={INVOICE_TONE[inv.status]} testID="sinv-status" /> : null}>
      <Loading error={error} onRetry={reload} loaded={Boolean(inv)} />
      {problem ? <ErrorBanner message={problem} testID="sinv-problem" /> : null}
      {inv ? (
        <>
          {inv.mismatches.length ? (
            <Section title="Differences found (PO / GRN / invoice)" testID="sinv-mismatches">
              {inv.mismatches.map((m, i) => <Text key={`${m.code}-${i}`} style={styles.danger}>• {m.message}</Text>)}
            </Section>
          ) : inv.status !== 'draft' ? <Text style={styles.muted}>Invoice matches the purchase order and accepted goods receipts.</Text> : null}
          <Section title="Amounts">
            <Text style={styles.muted}>Dated {formatDate(inv.invoiceDate)} · supplier GSTIN {inv.supplierGstin ?? '—'} (master {inv.vendor?.gstin ?? '—'})</Text>
            <Text style={styles.muted}>Taxable {formatMoney(inv.taxable)} · CGST {formatMoney(inv.cgst)} · SGST {formatMoney(inv.sgst)} · IGST {formatMoney(inv.igst)} · other {formatMoney(inv.other)}</Text>
            <Text style={styles.title}>Total {formatMoney(inv.total)}</Text>
          </Section>
          <Section title="Items">
            {inv.lines.map((l) => <Text key={l.poLineId} style={styles.muted}>S.No {l.serialNo} {l.description}: {formatNumber(l.qty)} {l.unit} @ {formatMoney(l.rate)}, GST {l.taxPercent}%</Text>)}
            <Text style={styles.muted}>Goods receipts: {inv.lots.map((l) => `Lot ${l.lotNo} (${l.challanNo})`).join(', ') || 'none linked'}</Text>
          </Section>
          {live ? (
            <Section title="Verification">
              <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline testID="sinv-remarks" />
              <View style={styles.row}>
                {inv.status === 'draft' ? <Button title="Submit for matching" onPress={() => act('submit')} loading={busy === 'submit'} /> : null}
                {inv.status !== 'draft' ? <Button title="Re-check match" variant="outline" onPress={() => act('rematch')} loading={busy === 'rematch'} testID="sinv-rematch" /> : null}
                {finance && ['matched', 'mismatch', 'submitted'].includes(inv.status) ? <Button title="Start verification" variant="outline" onPress={() => act('start')} loading={busy === 'start'} /> : null}
                {finance && ['matched', 'under_verification'].includes(inv.status) ? <Button title="Approve" onPress={() => act('approve')} loading={busy === 'approve'} testID="sinv-approve" /> : null}
                {finance && inv.status !== 'draft' ? <Button title="Reject" variant="ghost" onPress={() => act('reject')} loading={busy === 'reject'} testID="sinv-reject" /> : null}
                <Button title="Cancel entry" variant="ghost" onPress={() => act('cancel')} loading={busy === 'cancel'} />
              </View>
            </Section>
          ) : null}
          {inv.verificationRemarks ? <Text style={styles.muted}>Finance remarks: {inv.verificationRemarks}</Text> : null}
          <History rows={inv.history} />
        </>
      ) : null}
    </AppScreen>
  );
}
