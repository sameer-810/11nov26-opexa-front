import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { s, useData } from '../../inventory/ui';
import { canPaySuppliers, MODE_LABEL, STATUS_LABEL, statusTone, supplierPaymentApi, type SupplierPaymentStatus } from '../supplierPaymentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierPayments'>;
type Filter = 'all' | 'advance' | SupplierPaymentStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'submitted', label: 'Waiting for approval' }, { value: 'approved', label: 'To pay' },
  { value: 'paid', label: 'Paid' }, { value: 'advance', label: 'Advances to adjust' }, { value: 'cancelled', label: 'Cancelled' },
];

export function SupplierPaymentsScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const vendorId = route.params?.vendorId;
  const fetcher = useCallback(() => supplierPaymentApi.list({ vendorId, ...(filter === 'advance' ? { advance: 'true' as const } : filter === 'all' ? {} : { status: filter }) }), [filter, vendorId]);
  const { data, error, reload } = useData(fetcher);
  if (error) return <AppScreen title="Supplier payments" onBack={() => navigation.navigate('Payables')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  return (
    <AppScreen title="Supplier payments" onBack={() => navigation.navigate('Payables')} right={canPaySuppliers(user) ? <Button title="New payment" onPress={() => navigation.navigate('SupplierPaymentForm', vendorId ? { vendorId } : undefined)} testID="spay-list-new" /> : null} testID="supplier-payments-screen">
      <ChoiceChips label="Show" value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} testID="spay-filter" />
      {!data ? <ActivityIndicator /> : null}
      {data?.length === 0 ? <EmptyState title="No supplier payments" /> : null}
      <View style={s.list}>
        {data?.map((p) => (
          <Pressable key={p.id} style={s.card} onPress={() => navigation.navigate('SupplierPaymentDetail', { id: p.id })} testID={`spay-${p.number}`} accessibilityRole="button">
            <View style={s.row}>
              <Text style={s.number}>{p.number} · {formatMoney(p.amount)}</Text>
              <StatusChip label={STATUS_LABEL[p.status]} tone={statusTone(p.status)} />
              {p.isAdvance && p.status !== 'cancelled' ? <StatusChip label={`Advance ${formatMoney(p.onAccount)}`} tone="warning" /> : null}
            </View>
            <Text style={s.title}>{p.vendor?.name}</Text>
            <Text style={s.muted}>{formatDate(p.date)} · {MODE_LABEL[p.mode]}{p.reference ? ` ${p.reference}` : ''}{p.tds ? ` · TDS ${formatMoney(p.tds)}` : ''} · {p.allocations.map((a) => a.invoiceNumber).join(', ') || 'on account'}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
