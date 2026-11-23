import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { s, useData } from '../../inventory/ui';
import { AGEING_LABEL, canPaySuppliers, supplierPaymentApi, type Ageing } from '../supplierPaymentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Payables'>;
const ageingText = (a: Ageing) => (Object.keys(AGEING_LABEL) as (keyof Ageing)[]).filter((k) => a[k] > 0).map((k) => `${AGEING_LABEL[k]} ${formatMoney(a[k])}`).join(' · ') || 'Nothing outstanding';

// Supplier payables (4X): outstanding per supplier with ageing, advances not yet adjusted, and overdue invoices.
export function PayablesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const pays = canPaySuppliers(user);
  const [basis, setBasis] = useState<'invoice' | 'due'>('invoice');
  const fetcher = useCallback(() => supplierPaymentApi.payables({ basis }), [basis]);
  const { data, error, reload } = useData(fetcher);

  const right = (
    <View style={s.row}>
      <Button title="Payments" variant="outline" onPress={() => navigation.navigate('SupplierPayments')} testID="open-supplier-payments" />
      {pays ? <Button title="New payment" onPress={() => navigation.navigate('SupplierPaymentForm')} testID="new-supplier-payment" /> : null}
    </View>
  );
  if (error) return <AppScreen title="Supplier payables" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  return (
    <AppScreen title="Supplier payables" subtitle={data ? `Outstanding ${formatMoney(data.totals.outstanding)} · overdue ${formatMoney(data.totals.overdue)} · advances ${formatMoney(data.totals.advanceUnadjusted)}` : undefined} onBack={() => navigation.navigate('Dashboard')} right={right} testID="payables-screen">
      <ChoiceChips label="Age by" value={basis} onChange={(v) => setBasis(v as 'invoice' | 'due')} options={[{ value: 'invoice', label: 'Invoice date' }, { value: 'due', label: 'Due date (payment terms)' }]} testID="payables-basis" />
      {!data ? <ActivityIndicator /> : null}
      {data ? <Text style={s.muted} testID="payables-ageing">{ageingText(data.totals.ageing)}</Text> : null}
      {data?.vendors.length === 0 ? <EmptyState title="Nothing owed to suppliers" body="Approved supplier invoices appear here until they are paid." /> : null}
      <View style={s.list}>
        {data?.vendors.map((v) => (
          <View key={v.vendorId} style={s.card} testID={`payable-${v.vendorName}`}>
            <Text style={s.title}>{v.vendorName}</Text>
            <Text style={s.number}>Outstanding {formatMoney(v.outstanding)}{v.advanceUnadjusted > 0 ? ` · net ${formatMoney(v.netPayable)}` : ''}</Text>
            <Text style={s.muted}>Invoiced {formatMoney(v.invoiced)} · paid {formatMoney(v.paid)}{v.tds ? ` · TDS ${formatMoney(v.tds)}` : ''} · terms {v.termsDays} days</Text>
            {v.overdue > 0 ? <Text style={s.danger}>Overdue {formatMoney(v.overdue)}</Text> : null}
            {v.advanceUnadjusted > 0 ? <Text style={s.warn}>Advance not adjusted {formatMoney(v.advanceUnadjusted)}</Text> : null}
            <Text style={s.muted}>{ageingText(v.ageing)}</Text>
            <View style={s.row}>
              <Button title="Ledger" variant="ghost" onPress={() => navigation.navigate('SupplierLedger', { vendorId: v.vendorId })} testID={`ledger-${v.vendorName}`} />
              {pays && v.outstanding > 0 ? <Button title="Pay" variant="outline" onPress={() => navigation.navigate('SupplierPaymentForm', { vendorId: v.vendorId })} testID={`pay-vendor-${v.vendorName}`} /> : null}
            </View>
          </View>
        ))}
      </View>
      {data?.overdue.length ? <Text style={s.title}>Overdue invoices</Text> : null}
      <View style={s.list}>
        {data?.overdue.map((o) => (
          <View key={o.id} style={s.card} testID={`overdue-${o.number}`}>
            <Text style={s.title}>{o.vendorName} · {o.number}</Text>
            <Text style={s.danger}>{formatMoney(o.outstanding)} overdue by {o.daysOverdue} days (due {formatDate(o.dueDate)})</Text>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}
