import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { Button } from '../../../shared/ui/Button';
import { procurementApi } from '../api/procurementApi';
import { Loading, Section, Stat, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Procurement'>;
const RANGES = [{ value: '', label: 'All time' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }];

export function ProcurementDashboardScreen({ navigation }: Props) {
  const [range, setRange] = useState('');
  const fetcher = useCallback(() => procurementApi.dashboard(range ? { from: new Date(Date.now() - Number(range) * 86400000).toISOString() } : {}), [range]);
  const { data, error, reload } = useLoad(fetcher);
  const s = data?.sections;
  const k = data?.kpis;
  const go = (name: 'Rfqs' | 'FollowUps' | 'SupplierInvoices' | 'PendingQuantities' | 'Approvals' | 'PurchaseOrders' | 'Requisitions') => () => navigation.navigate(name);

  return (
    <AppScreen title="Procurement" subtitle="Requests to RFQ, quotations, POs, deliveries and supplier invoices" onBack={() => navigation.navigate('Dashboard')} testID="procurement-screen"
      right={<Button title="Pending quantities" variant="outline" onPress={go('PendingQuantities')} testID="go-pending" />}>
      <ChoiceChips label="Period (PO date)" options={RANGES} value={range} onChange={setRange} testID="proc-range" />
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {k ? (
        <Section title="Key figures">
          <View style={styles.grid}>
            <Stat label="Total procurement value" value={formatMoney(k.totalProcurementValue)} testID="kpi-total" />
            <Stat label="Open PO value" value={formatMoney(k.openPoValue)} />
            <Stat label="Ordered quantity" value={formatNumber(k.totalOrderedQty)} />
            <Stat label="Received quantity" value={formatNumber(k.totalReceivedQty)} />
            <Stat label="Pending delivery quantity" value={formatNumber(k.pendingDeliveryQty)} />
            <Stat label="Overdue POs" value={k.overduePoCount} tone={k.overduePoCount ? 'danger' : undefined} onPress={go('FollowUps')} />
            <Stat label="Quotations awaited" value={k.pendingQuotationCount} onPress={go('Rfqs')} />
            <Stat label="Invoice mismatches" value={k.invoiceMismatchCount} tone={k.invoiceMismatchCount ? 'danger' : undefined} onPress={go('SupplierInvoices')} />
          </View>
        </Section>
      ) : null}
      {s ? (
        <Section title="Work queues">
          <View style={styles.grid}>
            <Stat label="Material requests to buy" value={s.pendingMaterialRequests} onPress={go('Requisitions')} testID="q-requests" />
            <Stat label="Pending approvals" value={s.pendingApprovals} onPress={go('Approvals')} />
            <Stat label="Open RFQs" value={s.openRfqs} onPress={go('Rfqs')} />
            <Stat label="Awaiting supplier quotations" value={s.awaitingSupplierQuotations} onPress={go('Rfqs')} />
            <Stat label="Ready for comparison" value={s.readyForComparison} onPress={go('Rfqs')} />
            <Stat label="Pending supplier selection" value={s.pendingSupplierSelection} onPress={go('Rfqs')} tone={s.pendingSupplierSelection ? 'warning' : undefined} />
            <Stat label="Selections awaiting approval" value={s.selectionsAwaitingApproval} onPress={go('Approvals')} />
            <Stat label="Selections ready for PO" value={s.pendingPurchaseOrders} onPress={go('Rfqs')} tone={s.pendingPurchaseOrders ? 'warning' : undefined} />
            <Stat label="Open purchase orders" value={s.openPurchaseOrders} onPress={go('PurchaseOrders')} />
            <Stat label="Partial deliveries" value={s.partialDeliveries} onPress={go('FollowUps')} />
            <Stat label="Overdue deliveries" value={s.overdueDeliveries} onPress={go('FollowUps')} tone={s.overdueDeliveries ? 'danger' : undefined} />
            <Stat label="Follow-ups due" value={s.pendingFollowUps} onPress={go('FollowUps')} />
            <Stat label="Lots waiting for GRN" value={s.pendingGrns} />
            <Stat label="Supplier invoices pending" value={s.pendingSupplierInvoices} onPress={go('SupplierInvoices')} />
            <Stat label="Invoice mismatches" value={s.invoiceMismatches} onPress={go('SupplierInvoices')} tone={s.invoiceMismatches ? 'danger' : undefined} />
          </View>
        </Section>
      ) : null}
    </AppScreen>
  );
}
