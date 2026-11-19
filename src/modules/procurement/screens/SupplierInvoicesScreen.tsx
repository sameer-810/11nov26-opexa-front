import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { procurementApi } from '../api/procurementApi';
import { INVOICE_TONE, label } from '../types';
import { Loading, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierInvoices'>;
const FILTERS = ['', 'mismatch', 'matched', 'under_verification', 'approved', 'rejected', 'draft'].map((v) => ({ value: v, label: v ? label(v) : 'All' }));

export function SupplierInvoicesScreen({ navigation }: Props) {
  const [status, setStatus] = useState('');
  const fetcher = useCallback(() => procurementApi.invoices({ status }), [status]);
  const { data, error, reload } = useLoad(fetcher);
  return (
    <AppScreen title="Supplier invoices" subtitle="Each invoice is matched against its PO and accepted goods receipts" onBack={() => navigation.navigate('Procurement')} testID="sinv-screen">
      <ChoiceChips label="Status" options={FILTERS} value={status} onChange={setStatus} />
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {data?.length === 0 ? <EmptyState title="No supplier invoices" body="Open a purchase order and choose 'Book supplier invoice'." /> : null}
      <View style={styles.list}>
        {data?.map((i) => (
          <Pressable key={i.id} accessibilityRole="button" onPress={() => navigation.navigate('SupplierInvoiceDetail', { id: i.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`sinv-${i.number}`}>
            <View style={styles.row}><Text style={styles.number}>{i.number}</Text><StatusChip label={label(i.status)} tone={INVOICE_TONE[i.status]} /></View>
            <Text style={styles.title}>{i.vendor?.name} · {i.purchaseOrderNumber} · {formatMoney(i.total)}</Text>
            <Text style={styles.muted}>{formatDate(i.invoiceDate)} · FY {i.financialYear}{i.mismatches.length ? ` · ${i.mismatches.length} difference(s)` : ''}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
