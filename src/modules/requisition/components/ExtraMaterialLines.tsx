import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { inventoryApi } from '../../inventory/api/inventoryApi';
import type { Material } from '../../inventory/types';

export type ExtraLine = { materialId: string; label: string; unit: string; qty: string; specification: string; isNew: boolean };

const EMPTY_NEW = { name: '', unit: '', category: '', description: '', specifications: '' };

// Material outside the BOQ, picked from the material master (never billed). A material missing from the
// master can be added here; it is marked "New – verify" until the purchaser checks it.
export function ExtraMaterialLines({ value, onChange }: { value: ExtraLine[]; onChange: (v: ExtraLine[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_NEW);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { inventoryApi.materials(search.trim().length > 1 ? { q: search.trim() } : {}).then((m) => setMaterials(m.filter((x) => x.isActive))).catch(() => setMaterials([])); }, 250);
    return () => clearTimeout(t);
  }, [open, search]);

  const add = (m: Material) => {
    if (value.some((v) => v.materialId === m.id)) return;
    onChange([...value, { materialId: m.id, label: `${m.code} · ${m.name}`, unit: m.unit, qty: '', specification: m.specifications ?? '', isNew: m.verification === 'pending' }]);
  };
  const update = (i: number, patch: Partial<ExtraLine>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const saveNew = async () => {
    if (draft.name.trim().length < 2 || !draft.unit.trim()) return setProblem('Enter the material name and unit');
    setSaving(true);
    setProblem('');
    try {
      const m = await inventoryApi.createMaterial({
        name: draft.name.trim(), unit: draft.unit.trim(), category: draft.category.trim() || undefined, description: draft.description.trim() || undefined, specifications: draft.specifications.trim() || undefined,
      });
      add(m);
      setDraft(EMPTY_NEW);
      setAdding(false);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'Could not add the material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box} testID="extra-lines">
      <Text style={styles.title}>Material not in the BOQ (not billed)</Text>
      {value.map((v, i) => (
        <View key={v.materialId} style={styles.line} testID={`extra-line-${i}`}>
          <View style={styles.row}>
            <Text style={[styles.item, styles.flex]}>{v.label} ({v.unit})</Text>
            {v.isNew ? <StatusChip label="New – verify" tone="warning" /> : null}
            <Button title="Remove" variant="ghost" onPress={() => onChange(value.filter((_, j) => j !== i))} />
          </View>
          <View style={styles.row}>
            <View style={styles.qty}><TextField label={`Quantity (${v.unit})`} value={v.qty} onChangeText={(q) => update(i, { qty: q })} keyboardType="decimal-pad" testID={`extra-qty-${i}`} /></View>
            <View style={styles.flex}><TextField label="Specification (optional)" value={v.specification} onChangeText={(t) => update(i, { specification: t })} maxLength={500} testID={`extra-spec-${i}`} /></View>
          </View>
        </View>
      ))}
      {problem ? <ErrorBanner message={problem} testID="extra-problem" /> : null}
      {open ? (
        <View style={styles.gap}>
          <TextField label="Find material" value={search} onChangeText={setSearch} placeholder="Name or code" testID="extra-search" />
          <View style={styles.row}>
            {materials.slice(0, 20).map((m) => (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => add(m)} style={styles.chip} testID={`extra-mat-${m.code}`}>
                <Text style={styles.item}>{m.name} ({m.unit}){m.verification === 'pending' ? ' · new' : ''}</Text>
              </Pressable>
            ))}
            {!materials.length ? <Text style={styles.muted}>No materials found.</Text> : null}
          </View>
          {adding ? (
            <View style={styles.newBox}>
              <Text style={styles.item}>New material (the purchaser will verify it)</Text>
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="Name" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} testID="extra-new-name" /></View>
                <View style={styles.qty}><TextField label="Unit" value={draft.unit} onChangeText={(t) => setDraft({ ...draft, unit: t })} placeholder="Nos, Rmt, Kg" testID="extra-new-unit" /></View>
                <View style={styles.flex}><TextField label="Category" value={draft.category} onChangeText={(t) => setDraft({ ...draft, category: t })} testID="extra-new-category" /></View>
              </View>
              <TextField label="Description" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} maxLength={500} testID="extra-new-description" />
              <TextField label="Specifications" value={draft.specifications} onChangeText={(t) => setDraft({ ...draft, specifications: t })} maxLength={500} testID="extra-new-specs" />
              <View style={styles.row}>
                <Button title="Add material" onPress={saveNew} loading={saving} testID="extra-new-save" />
                <Button title="Cancel" variant="ghost" onPress={() => { setAdding(false); setProblem(''); }} />
              </View>
            </View>
          ) : <Button title="Not in the list? Add a new material" variant="ghost" onPress={() => setAdding(true)} testID="extra-new-open" />}
        </View>
      ) : <Button title="Add material not in the BOQ" variant="outline" onPress={() => setOpen(true)} testID="extra-open" />}
    </View>
  );
}

export const extraLinesFor = (v: ExtraLine[]) =>
  v.map((l) => ({ materialId: l.materialId, qty: parseNumber(l.qty) ?? 0, ...(l.specification.trim() ? { specification: l.specification.trim() } : {}) })).filter((l) => l.qty > 0);

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  item: { fontSize: 14, color: colors.text },
  line: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flexGrow: 1, flexBasis: 200 },
  qty: { flexBasis: 120, flexGrow: 0 },
  gap: { gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  newBox: { gap: spacing.sm, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: radius.md, padding: spacing.sm },
});
