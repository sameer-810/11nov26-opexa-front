import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatMoney, formatNumber } from '../../../shared/format';
import type { BoqColumn, BoqColumnKey, BoqItem, BoqViewLine } from '../types';

export type BoqLine = BoqItem & Partial<Omit<BoqViewLine, keyof BoqItem>>;
type Props = { columns: BoqColumn[]; lines: BoqLine[]; onPressItem?: (item: BoqLine) => void };

const QTY: BoqColumnKey[] = ['quantity', 'variationQty', 'executedQty', 'approvedQty'];
const MONEY: BoqColumnKey[] = ['rate', 'supplyRate', 'installationRate', 'amount', 'supplyAmount', 'installationAmount'];
const TOTALLED: BoqColumnKey[] = ['amount', 'supplyAmount', 'installationAmount'];
const WIDTH: Partial<Record<BoqColumnKey, number>> = { serialNo: 64, description: 300, unit: 70, remarks: 200 };
const widthOf = (k: BoqColumnKey) => WIDTH[k] ?? (MONEY.includes(k) ? 125 : 100);
const right = (k: BoqColumnKey) => QTY.includes(k) || MONEY.includes(k);

function cell(line: BoqLine, k: BoqColumnKey): string {
  const v = line[k];
  if (v === null || v === undefined || v === '') return '—';
  if (QTY.includes(k)) return formatNumber(Number(v));
  if (MONEY.includes(k)) return formatMoney(Number(v));
  return String(v);
}
const overCell = (line: BoqLine, k: BoqColumnKey) => Boolean(line.overBoq) && (k === 'executedQty' || k === 'approvedQty') && Number(line[k] ?? 0) > line.quantity;

// 3B: renders the project's configured columns. Wide screens get a table (scrolls sideways); phones get one card per line.
export function BoqTable({ columns, lines, onPressItem }: Props) {
  const { width } = useWindowDimensions();
  const cols = [...columns].filter((c) => c.visible).sort((a, b) => a.order - b.order);
  const totals = Object.fromEntries(TOTALLED.map((k) => [k, lines.reduce((s, l) => s + Number(l[k] ?? 0), 0)])) as Record<string, number>;
  const totalText = (k: BoqColumnKey) => formatMoney(totals[k] ?? 0);
  const over = lines.filter((l) => l.overBoq).length;

  if (width < 700) {
    const [title, ...rest] = cols;
    return (
      <View style={styles.cards} testID="boq-cards">
        {lines.map((l) => (
          <Pressable key={l.id} onPress={onPressItem ? () => onPressItem(l) : undefined} disabled={!onPressItem} style={({ pressed }) => [styles.card, l.overBoq && styles.overRow, pressed && styles.pressed]} testID={`boq-row-${l.serialNo}`}>
            {title ? <Text style={styles.cardTitle}>{cell(l, title.key)}</Text> : null}
            {rest.map((c) => (
              <View key={c.key} style={styles.pair}>
                <Text style={styles.pairLabel}>{c.label}</Text>
                <Text style={[styles.pairValue, overCell(l, c.key) && styles.overText]}>{cell(l, c.key)}</Text>
              </View>
            ))}
            {l.overBoq ? <Text style={styles.overText} testID={`boq-over-${l.serialNo}`}>Over BOQ by {formatNumber(l.overBoqQty ?? 0)} {l.unit}</Text> : null}
          </Pressable>
        ))}
        <View style={[styles.card, styles.foot]}>
          <Text style={styles.cardTitle}>Total ({lines.length} items)</Text>
          {cols.filter((c) => TOTALLED.includes(c.key)).map((c) => (
            <View key={c.key} style={styles.pair}>
              <Text style={styles.pairLabel}>{c.label}</Text>
              <Text style={styles.pairValue} testID={c.key === 'amount' ? 'boq-total' : `boq-total-${c.key}`}>{totalText(c.key)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      {over ? <Text style={styles.overText} testID="boq-over-summary">{over} line{over === 1 ? '' : 's'} executed or approved beyond the BOQ quantity</Text> : null}
      <ScrollView horizontal testID="boq-table">
        <View style={styles.table}>
          <View style={[styles.row, styles.head]}>
            {cols.map((c) => (
              <Text key={c.key} style={[styles.th, { width: widthOf(c.key) }, right(c.key) && styles.right]} testID={`boq-col-${c.key}`}>{c.label}</Text>
            ))}
          </View>
          {lines.map((l) => (
            <Pressable key={l.id} onPress={onPressItem ? () => onPressItem(l) : undefined} disabled={!onPressItem} style={({ pressed }) => [styles.row, l.overBoq && styles.overRow, pressed && styles.pressed]} testID={`boq-row-${l.serialNo}`}>
              {cols.map((c) => (
                <Text key={c.key} style={[styles.td, { width: widthOf(c.key) }, right(c.key) && styles.right, overCell(l, c.key) && styles.overText]} numberOfLines={2}>
                  {cell(l, c.key)}
                </Text>
              ))}
            </Pressable>
          ))}
          <View style={[styles.row, styles.foot]}>
            {cols.map((c, i) => (
              <Text key={c.key} style={[styles.th, { width: widthOf(c.key) }, right(c.key) && styles.right]} numberOfLines={2} testID={c.key === 'amount' ? 'boq-total' : TOTALLED.includes(c.key) ? `boq-total-${c.key}` : undefined}>
                {TOTALLED.includes(c.key) ? totalText(c.key) : i === 0 ? `Total (${lines.length})` : ''}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 40, alignItems: 'center' },
  head: { backgroundColor: colors.surfaceAlt },
  foot: { backgroundColor: colors.surfaceAlt, borderBottomWidth: 0 },
  pressed: { backgroundColor: '#EFF6FF' },
  overRow: { backgroundColor: '#FFF7ED' },
  overText: { color: '#B45309', fontWeight: '700' },
  th: { fontSize: 13, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  td: { fontSize: 14, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  right: { textAlign: 'right' },
  cards: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pair: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  pairLabel: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  pairValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
