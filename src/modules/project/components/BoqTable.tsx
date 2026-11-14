import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatMoney, formatNumber } from '../../../shared/format';
import type { BoqItem } from '../types';

type Props = { items: BoqItem[]; onPressItem?: (item: BoqItem) => void };

const COLS = [
  { key: 'serialNo', label: 'S.No', width: 60 },
  { key: 'description', label: 'Description', width: 320 },
  { key: 'unit', label: 'Unit', width: 70 },
  { key: 'quantity', label: 'Qty', width: 90, right: true },
  { key: 'rate', label: 'Rate', width: 110, right: true },
  { key: 'amount', label: 'Amount', width: 130, right: true },
] as const;

// Scrolls sideways on small screens so columns stay readable.
export function BoqTable({ items, onPressItem }: Props) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const cell = (i: BoqItem, k: (typeof COLS)[number]['key']) => {
    if (k === 'quantity') return formatNumber(i.quantity);
    if (k === 'rate') return formatMoney(i.rate);
    if (k === 'amount') return formatMoney(i.amount);
    return String(i[k]);
  };
  return (
    <ScrollView horizontal testID="boq-table">
      <View style={styles.table}>
        <View style={[styles.row, styles.head]}>
          {COLS.map((c) => (
            <Text key={c.key} style={[styles.th, { width: c.width }, 'right' in c && styles.right]}>{c.label}</Text>
          ))}
        </View>
        {items.map((i) => (
          <Pressable key={i.id} onPress={onPressItem ? () => onPressItem(i) : undefined} disabled={!onPressItem} style={({ pressed }) => [styles.row, pressed && styles.pressed]} testID={`boq-row-${i.serialNo}`}>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.td, { width: c.width }, 'right' in c && styles.right]} numberOfLines={2}>
                {cell(i, c.key)}
              </Text>
            ))}
          </Pressable>
        ))}
        <View style={[styles.row, styles.foot]}>
          <Text style={[styles.th, { width: COLS.slice(0, 5).reduce((s, c) => s + c.width, 0) }]}>Total ({items.length} items)</Text>
          <Text style={[styles.th, styles.right, { width: 130 }]} testID="boq-total">{formatMoney(total)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 40, alignItems: 'center' },
  head: { backgroundColor: colors.surfaceAlt },
  foot: { backgroundColor: colors.surfaceAlt, borderBottomWidth: 0 },
  pressed: { backgroundColor: '#EFF6FF' },
  th: { fontSize: 13, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  td: { fontSize: 14, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  right: { textAlign: 'right' },
});
