import { StyleSheet, Text, View } from 'react-native';
import type { ApprovalDetail } from '../../approval/api/approvalApi';
import { colors } from '../../../shared/designSystem';
import { formatDate, formatMoney } from '../../../shared/format';

type Details = NonNullable<ApprovalDetail['details']>;

// What an approver sees for a supplier payment: supplier, amount and mode, and the invoices it settles.
export function SupplierPaymentApprovalDetails({ d }: { d: Details }) {
  return (
    <View style={styles.gap} testID="approval-supplier-payment">
      <Text style={styles.text}>{d.vendor?.name} · {formatMoney(d.amount ?? 0)}{d.tds ? ` + TDS ${formatMoney(d.tds)}` : ''} · {(d.mode ?? '').toUpperCase()}{d.reference ? ` ${d.reference}` : ''}</Text>
      {d.invoices?.map((a) => <Text key={a.supplierInvoiceId} style={styles.text}>Invoice {a.invoiceNumber} ({formatDate(a.invoiceDate)}): {formatMoney(a.amount)}</Text>)}
      {d.isAdvance ? <Text style={styles.warn}>Advance on account: {formatMoney(d.onAccount ?? 0)} (not against an invoice yet)</Text> : null}
      {d.remarks ? <Text style={styles.text}>{d.remarks}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 4 },
  text: { fontSize: 14, color: colors.text },
  warn: { fontSize: 14, color: '#B45309', fontWeight: '600' },
});
