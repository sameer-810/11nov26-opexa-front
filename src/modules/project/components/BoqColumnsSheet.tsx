import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { BoqColumn } from '../types';

type Props = { columns: BoqColumn[]; onSave: (columns: BoqColumn[]) => Promise<void>; onCancel: () => void };

// Q19: show/hide, rename and reorder the fixed BOQ columns. For people who manage the project.
export function BoqColumnsSheet({ columns, onSave, onCancel }: Props) {
  const [cols, setCols] = useState(() => [...columns].sort((a, b) => a.order - b.order));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (i: number, change: Partial<BoqColumn>) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const move = (i: number, by: -1 | 1) => setCols((cs) => {
    const next = [...cs];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  });

  const save = async () => {
    setError('');
    if (cols.some((c) => !c.label.trim())) return setError('Every column needs a name');
    if (!cols.some((c) => c.visible)) return setError('Show at least one column');
    setBusy(true);
    try {
      await onSave(cols.map((c, order) => ({ ...c, label: c.label.trim(), order })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the columns');
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="boq-columns-sheet">
      <Text style={styles.title}>BOQ columns</Text>
      <Text style={styles.muted}>Show, hide, rename or reorder columns. This changes the screen and the Excel export, not the BOQ values.</Text>
      {error ? <ErrorBanner message={error} testID="boq-columns-error" /> : null}
      {cols.map((c, i) => (
        <View key={c.key} style={styles.row} testID={`col-row-${c.key}`}>
          <TextInput
            value={c.label}
            onChangeText={(label) => patch(i, { label })}
            maxLength={40}
            accessibilityLabel={`Name of column ${i + 1}`}
            style={[styles.input, !c.visible && styles.hidden]}
            testID={`col-label-${c.key}`}
          />
          <Button title={c.visible ? 'Hide' : 'Show'} variant="ghost" onPress={() => patch(i, { visible: !c.visible })} testID={`col-toggle-${c.key}`} />
          <Button title="Up" variant="ghost" disabled={i === 0} onPress={() => move(i, -1)} testID={`col-up-${c.key}`} />
          <Button title="Down" variant="ghost" disabled={i === cols.length - 1} onPress={() => move(i, 1)} testID={`col-down-${c.key}`} />
        </View>
      ))}
      <View style={styles.row}>
        <Button title="Save columns" onPress={save} loading={busy} testID="boq-columns-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: '#F8FAFF' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  input: { flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  hidden: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
