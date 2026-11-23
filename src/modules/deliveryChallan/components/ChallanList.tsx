import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, formatNumber } from '../../../shared/format';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { DeliveryChallan } from '../types';

type Props = { items: DeliveryChallan[]; onOpen: (dc: DeliveryChallan) => void; showRequest?: boolean; testID?: string };

// Challan cards: number, date, request, supplier and what came on it.
export function ChallanList({ items, onOpen, showRequest = false, testID = 'dc-list' }: Props) {
  return (
    <View style={styles.list} testID={testID}>
      {items.map((dc) => (
        <Pressable key={dc.id} onPress={() => onOpen(dc)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`dc-${dc.number}`}>
          <View style={styles.top}>
            <Text style={styles.number}>{dc.number}</Text>
            <StatusChip label={dc.status === 'active' ? 'Received' : 'Cancelled'} tone={dc.status === 'active' ? 'success' : 'neutral'} />
          </View>
          <Text style={styles.muted}>
            {[formatDate(dc.date), showRequest ? `${dc.requisitionNumber} · ${dc.projectCode ?? ''} ${dc.projectName ?? ''}` : null, dc.supplierName || null, dc.vendorChallanNo ? `supplier challan ${dc.vendorChallanNo}` : null].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.text}>{dc.lines.map((l) => `${l.serialNo} × ${formatNumber(l.qty)} ${l.unit}`).join(', ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 15, fontWeight: '800', color: colors.primary },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
});
