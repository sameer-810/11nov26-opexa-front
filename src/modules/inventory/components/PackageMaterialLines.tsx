import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { inventoryApi } from '../api/inventoryApi';
import type { Material } from '../types';

export type PackageLine = { workOrderItemId: string; materialId: string; label: string; qty: string };
type BoqOption = { workOrderItemId: string; serialNo: string; description: string };

// Raw material a package BOQ line needs but the BOQ does not list (e.g. copper pipe for a ductable AC).
// Bought against that BOQ line, never billed to the client, counted in project cost.
export function PackageMaterialLines({ boq, value, onChange }: { boq: BoqOption[]; value: PackageLine[]; onChange: (v: PackageLine[]) => void }) {
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState('');
  const [search, setSearch] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { inventoryApi.materials(search.trim().length > 1 ? { q: search.trim() } : {}).then(setMaterials).catch(() => setMaterials([])); }, 250);
    return () => clearTimeout(t);
  }, [open, search]);

  const add = (m: Material) => {
    if (!parent) return;
    const item = boq.find((b) => b.workOrderItemId === parent);
    if (value.some((v) => v.workOrderItemId === parent && v.materialId === m.id)) return;
    onChange([...value, { workOrderItemId: parent, materialId: m.id, label: `${m.name} (${m.unit}) for S.No ${item?.serialNo}`, qty: '' }]);
  };

  return (
    <View style={styles.box} testID="package-lines">
      <Text style={styles.title}>Extra material for package items (not billed)</Text>
      <Text style={styles.muted}>For items the BOQ does not list, e.g. copper pipe and insulation for a ductable AC. They are bought against the BOQ line you choose and count in that line's cost.</Text>
      {value.map((v, i) => (
        <View key={`${v.workOrderItemId}-${v.materialId}`} style={styles.row}>
          <Text style={[styles.item, styles.flex]}>{v.label}</Text>
          <TextField label="Quantity" value={v.qty} onChangeText={(q) => onChange(value.map((x, j) => (j === i ? { ...x, qty: q } : x)))} keyboardType="decimal-pad" testID={`pkg-qty-${i}`} />
          <Button title="Remove" variant="ghost" onPress={() => onChange(value.filter((_, j) => j !== i))} />
        </View>
      ))}
      {open ? (
        <View style={styles.gap}>
          <ChoiceChips label="For which BOQ line?" options={boq.map((b) => ({ value: b.workOrderItemId, label: `${b.serialNo}. ${b.description.slice(0, 30)}` }))} value={parent} onChange={setParent} testID="pkg-parent" />
          <TextField label="Find material" value={search} onChangeText={setSearch} placeholder="e.g. copper" testID="pkg-search" />
          <View style={styles.row}>
            {materials.slice(0, 20).map((m) => (
              <Pressable key={m.id} accessibilityRole="button" disabled={!parent} onPress={() => add(m)} style={[styles.chip, !parent && styles.off]} testID={`pkg-mat-${m.code}`}>
                <Text style={styles.item}>{m.name} ({m.unit})</Text>
              </Pressable>
            ))}
            {!materials.length ? <Text style={styles.muted}>No materials found. Ask the store to add it to the material list.</Text> : null}
          </View>
        </View>
      ) : <Button title="Add extra material" variant="outline" onPress={() => setOpen(true)} testID="pkg-open" />}
    </View>
  );
}

export const packageLinesFor = (v: PackageLine[]) => v.map((l) => ({ workOrderItemId: l.workOrderItemId, materialId: l.materialId, billable: false, qty: parseNumber(l.qty) ?? 0 })).filter((l) => l.qty > 0);

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  item: { fontSize: 14, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flexGrow: 1, flexBasis: 200 },
  gap: { gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  off: { opacity: 0.5 },
});
