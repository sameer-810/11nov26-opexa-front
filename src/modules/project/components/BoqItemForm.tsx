import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { validateItemForm, type ItemErrors, type ItemForm } from '../project.validation';
import type { BoqItem, BoqItemInput } from '../types';

type Props = {
  initial?: BoqItem;
  suggestedSerial?: string;
  onSave: (input: BoqItemInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
};

export function BoqItemForm({ initial, suggestedSerial, onSave, onCancel, onDelete }: Props) {
  const [form, setForm] = useState<ItemForm>({
    serialNo: initial?.serialNo ?? suggestedSerial ?? '',
    description: initial?.description ?? '',
    unit: initial?.unit ?? '',
    quantity: initial ? String(initial.quantity) : '',
    rate: initial ? String(initial.rate) : '',
  });
  const [errors, setErrors] = useState<ItemErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'delete'>('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: keyof ItemForm) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = async () => {
    setError('');
    const found = validateItemForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy('save');
    try {
      await onSave({
        serialNo: form.serialNo.trim(),
        description: form.description.trim(),
        unit: form.unit.trim(),
        quantity: parseNumber(form.quantity) ?? 0,
        rate: parseNumber(form.rate) ?? 0,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        const fe: ItemErrors = {};
        e.details.forEach((d) => {
          fe[d.field as keyof ItemForm] = d.message;
        });
        setErrors(fe);
        setError(e.message);
      } else setError('Something went wrong');
      setBusy('');
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    setBusy('delete');
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy('');
    }
  };

  return (
    <View style={styles.box} testID="boq-item-form">
      <Text style={styles.title}>{initial ? `Edit item ${initial.serialNo}` : 'Add BOQ item'}</Text>
      {error ? <ErrorBanner message={error} testID="boq-item-error" /> : null}
      <View style={styles.row}>
        <View style={styles.small}><TextField label="S.No" testID="bi-serial" value={form.serialNo} onChangeText={set('serialNo')} error={errors.serialNo} /></View>
        <View style={styles.big}><TextField label="Description" testID="bi-desc" value={form.description} onChangeText={set('description')} error={errors.description} /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.small}><TextField label="Unit" testID="bi-unit" value={form.unit} onChangeText={set('unit')} error={errors.unit} placeholder="Nos" /></View>
        <View style={styles.mid}><TextField label="Quantity" testID="bi-qty" value={form.quantity} onChangeText={set('quantity')} error={errors.quantity} keyboardType="decimal-pad" /></View>
        <View style={styles.mid}><TextField label="Rate (₹)" testID="bi-rate" value={form.rate} onChangeText={set('rate')} error={errors.rate} keyboardType="decimal-pad" /></View>
      </View>
      <View style={styles.actions}>
        <Button title={initial ? 'Save item' : 'Add item'} onPress={save} loading={busy === 'save'} testID="bi-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
        {onDelete && !confirmDelete ? <Button title="Delete" variant="ghost" onPress={() => setConfirmDelete(true)} testID="bi-delete" /> : null}
        {onDelete && confirmDelete ? (
          <Button title="Yes, delete this item" onPress={remove} loading={busy === 'delete'} style={styles.danger} testID="bi-confirm-delete" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, backgroundColor: '#F8FAFF' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  small: { flexBasis: 100, flexGrow: 1 },
  mid: { flexBasis: 140, flexGrow: 1 },
  big: { flexBasis: 300, flexGrow: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  danger: { backgroundColor: colors.danger },
});
