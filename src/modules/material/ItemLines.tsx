import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatNumber } from '../../shared/format';
import { TextField } from '../../shared/ui/TextField';
import { colors, radius, spacing } from '../../shared/designSystem';

export type PickItem = { id: string; serialNo: string; description: string; unit: string; available?: number };
export type Line = { itemId: string; qty: string; extra?: string };

// Search a BOQ list by S.No or name; tap to pick.
export function ItemSearch({ items, onPick, exclude = [], label = 'Add item (search S.No or name)', testID, error }: {
  items: PickItem[]; onPick: (i: PickItem) => void; exclude?: string[]; label?: string; testID: string; error?: string;
}) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const matches = t ? items.filter((i) => !exclude.includes(i.id) && (i.serialNo.toLowerCase() === t || i.description.toLowerCase().includes(t))).slice(0, 8) : [];
  return (
    <View style={styles.gap}>
      <TextField label={label} value={q} onChangeText={setQ} testID={testID} error={error} />
      {matches.map((i) => (
        <Pressable key={i.id} onPress={() => { onPick(i); setQ(''); }} style={styles.match} testID={`${testID}-pick-${i.serialNo}`}>
          <Text>{i.serialNo}. {i.description}{i.available !== undefined ? ` · at site ${formatNumber(i.available)} ${i.unit}` : ` (${i.unit})`}</Text>
        </Pressable>
      ))}
      {t && matches.length === 0 ? <Text style={styles.muted}>No matching item{items.length ? '' : 's at site'}.</Text> : null}
    </View>
  );
}

// The chosen lines with a quantity box each.
export function LineList({ lines, items, onQty, onRemove, errors = {}, testID, renderExtra }: {
  lines: Line[]; items: PickItem[]; onQty: (id: string, v: string) => void; onRemove: (id: string) => void; errors?: Record<string, string>; testID: string;
  renderExtra?: (line: Line) => React.ReactNode;
}) {
  return (
    <View style={styles.gap}>
      {lines.map((l) => {
        const i = items.find((x) => x.id === l.itemId)!;
        return (
          <View key={l.itemId} style={styles.line} testID={`${testID}-line-${i.serialNo}`}>
            <View style={styles.row}>
              <Text style={styles.title}>{i.serialNo}. {i.description}</Text>
              <Pressable onPress={() => onRemove(l.itemId)} testID={`${testID}-remove-${i.serialNo}`}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
            <View style={styles.row}>
              <TextInput value={l.qty} onChangeText={(v) => onQty(l.itemId, v)} keyboardType="decimal-pad" inputMode="decimal" placeholder="Qty" style={styles.input} testID={`${testID}-qty-${i.serialNo}`} />
              <Text style={styles.muted}>{i.unit}{i.available !== undefined ? ` · at site ${formatNumber(i.available)}` : ''}</Text>
            </View>
            {renderExtra ? renderExtra(l) : null}
            {errors[l.itemId] ? <Text style={styles.err}>{errors[l.itemId]}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  match: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  line: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between', flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, minWidth: 110, color: colors.text },
  remove: { color: colors.danger, fontSize: 13 },
  muted: { fontSize: 13, color: colors.textMuted, flex: 1 },
  err: { fontSize: 13, color: colors.danger },
});
