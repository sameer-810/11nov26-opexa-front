import { StyleSheet, Text, TextInput, View } from 'react-native';
import { formatNumber, parseNumber } from '../../../shared/format';
import { TextField } from '../../../shared/ui/TextField';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { BalanceRow } from '../types';

export type BoqEntry = { qty: string; specification: string };

type Props = { rows: BalanceRow[]; value: Record<string, BoqEntry>; onChange: (id: string, entry: BoqEntry) => void };

// BOQ items with their balance: quantity needed now and, once a quantity is entered, its specification.
export function BoqLines({ rows, value, onChange }: Props) {
  return (
    <View style={styles.list}>
      {rows.map((r) => {
        const entry = value[r.workOrderItemId] ?? { qty: '', specification: '' };
        const n = parseNumber(entry.qty) ?? 0;
        const willExceed = n > 0 && n > r.balance;
        return (
          <View key={r.workOrderItemId} style={[styles.item, n > 0 && styles.itemOn]} testID={`req-item-${r.serialNo}`}>
            <View style={styles.top}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{r.serialNo}. {r.description}</Text>
                <Text style={styles.muted}>
                  BOQ {formatNumber(r.boqQty)} {r.unit} · requested {formatNumber(r.requested)} ·{' '}
                  <Text style={r.balance <= 0 ? styles.extra : styles.balance}>balance {formatNumber(r.balance)}</Text>
                </Text>
                {r.delivered !== undefined ? (
                  <Text style={styles.muted} testID={`req-progress-${r.serialNo}`}>
                    delivered {formatNumber(r.delivered)} · pending {formatNumber(r.pending ?? 0)}{n > 0 ? ` · total requested with this ${formatNumber(r.requested + n)}` : ''}
                  </Text>
                ) : null}
                {willExceed ? <Text style={styles.extra}>More than the balance: {formatNumber(n - Math.max(r.balance, 0))} extra</Text> : null}
              </View>
              <View style={styles.qtyBox}>
                <TextInput
                  value={entry.qty}
                  onChangeText={(v) => onChange(r.workOrderItemId, { ...entry, qty: v })}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0"
                  style={[styles.qtyInput, willExceed && styles.qtyWarn]}
                  accessibilityLabel={`Quantity for ${r.description}`}
                  testID={`req-qty-${r.serialNo}`}
                />
                <Text style={styles.unit}>{r.unit}</Text>
              </View>
            </View>
            {n > 0 ? (
              <TextField label="Specification (optional)" value={entry.specification} onChangeText={(v) => onChange(r.workOrderItemId, { ...entry, specification: v })} placeholder="Make, size, grade…" maxLength={500} testID={`req-spec-${r.serialNo}`} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemOn: { borderColor: colors.primary, backgroundColor: '#F8FAFF' },
  flex: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  balance: { color: colors.success, fontWeight: '700' },
  extra: { color: colors.danger, fontWeight: '700' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyInput: { width: 90, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10, fontSize: 16, textAlign: 'right', color: colors.text },
  qtyWarn: { borderColor: colors.danger },
  unit: { width: 44, fontSize: 13, color: colors.textMuted },
});
