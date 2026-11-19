import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { procurementApi } from '../api/procurementApi';
import { FollowUpForm } from '../components/FollowUpForm';
import { Loading, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowUps'>;

export function FollowUpsScreen({ navigation }: Props) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState('');
  const fetcher = useCallback(() => procurementApi.followUpBoard({ overdue: filter === 'overdue' ? 'true' : undefined }), [filter]);
  const { data, error, reload } = useLoad(fetcher);
  return (
    <AppScreen title="Pending deliveries" subtitle="Open POs with quantity still due; log supplier follow-ups" onBack={() => navigation.navigate('Procurement')} testID="followups-screen">
      <ChoiceChips label="Show" options={[{ value: '', label: 'All open' }, { value: 'overdue', label: 'Overdue only' }]} value={filter} onChange={setFilter} />
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {data?.length === 0 ? <EmptyState title="Nothing pending" body="Every issued PO has been fully received." /> : null}
      <View style={styles.list}>
        {data?.map((r) => (
          <View key={r.purchaseOrderId} style={styles.card} testID={`fu-${r.number}`}>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate('PurchaseOrderDetail', { id: r.purchaseOrderId })}>
              <View style={styles.row}><Text style={styles.number}>{r.number}</Text>{r.overdue ? <StatusChip label={`${r.daysOverdue} day(s) overdue`} tone="danger" /> : null}{r.followUpDue ? <StatusChip label="Follow-up due" tone="warning" /> : null}</View>
              <Text style={styles.title}>{r.vendor?.name} → {r.projectName}</Text>
              <Text style={styles.muted}>Due {formatDate(r.expectedDate)} · pending {formatNumber(r.pendingQty)} ({formatMoney(r.pendingValue)}){r.lastFollowUp ? ` · last: ${formatDate(r.lastFollowUp.followUpDate)} ${r.lastFollowUp.method} — ${r.lastFollowUp.supplierResponse || r.lastFollowUp.remarks}` : ' · no follow-up yet'}{r.nextFollowUpDate ? ` · next ${formatDate(r.nextFollowUpDate)}` : ''}</Text>
            </Pressable>
            {open === r.purchaseOrderId ? <FollowUpForm purchaseOrderId={r.purchaseOrderId} onSaved={() => { setOpen(''); void reload(); }} onCancel={() => setOpen('')} />
              : <Pressable accessibilityRole="button" onPress={() => setOpen(r.purchaseOrderId)} testID={`fu-add-${r.number}`}><Text style={styles.number}>+ Log follow-up</Text></Pressable>}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}
