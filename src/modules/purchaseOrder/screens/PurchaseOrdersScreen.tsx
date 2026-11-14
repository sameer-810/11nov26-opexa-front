import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { purchaseOrderApi } from '../api/purchaseOrderApi';
import { DELIVERY_LABEL, type PurchaseOrder } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseOrders'>;

export function PurchaseOrdersScreen({ navigation }: Props) {
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await purchaseOrderApi.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <AppScreen title="Purchase orders" subtitle="Raise POs from material requests; record each delivery as a lot" onBack={() => navigation.navigate('Dashboard')} testID="pos-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No purchase orders yet" body="Open a material request and choose 'Create purchase order'." /> : null}
      <View style={styles.list}>
        {rows?.map((po) => {
          const pending = po.lines.reduce((s, l) => s + l.pending, 0);
          return (
            <Pressable key={po.id} onPress={() => navigation.navigate('PurchaseOrderDetail', { id: po.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`po-${po.number}`}>
              <View style={styles.top}>
                <Text style={styles.number}>{po.number}</Text>
                <StatusChip label={DELIVERY_LABEL[po.deliveryStatus]} tone={po.deliveryStatus === 'dispatched' ? 'success' : po.deliveryStatus === 'partly-dispatched' ? 'warning' : po.deliveryStatus === 'cancelled' ? 'neutral' : 'info'} />
              </View>
              <Text style={styles.title}>{po.vendor?.name} → {po.projectCode} {po.projectName}</Text>
              <Text style={styles.muted}>{po.lines.length} item(s) · {formatMoney(po.total)} · {formatDate(po.createdAt)} · {po.lots.length} lot(s){pending > 0 && po.status === 'issued' ? ' · items pending' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 15, fontWeight: '800', color: colors.primary },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
