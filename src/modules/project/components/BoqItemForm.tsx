import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { validateItemForm, type ItemErrors, type ItemForm } from '../project.validation';
import type { BoqFormat, BoqItem, BoqItemInput } from '../types';

type Props = {
  initial?: BoqItem;
  format?: BoqFormat;
  suggestedSerial?: string;
  onSave: (input: BoqItemInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
};

export function BoqItemForm({ initial, format = 'sitc', suggestedSerial, onSave, onCancel, onDelete }: Props) {
  const split = format === 'supply_installation';
  const [form, setForm] = useState<ItemForm>({
    serialNo: initial?.serialNo ?? suggestedSerial ?? '',
    description: initial?.description ?? '',
    unit: initial?.unit ?? '',
    quantity: initial ? String(initial.quantity) : '',
    rate: initial ? String(initial.rate) : '',
    supplyRate: initial?.supplyRate != null ? String(initial.supplyRate) : '',
    installationRate: initial?.installationRate != null ? String(initial.installationRate) : '',
    remarks: initial?.remarks ?? '',
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
        // Q18: split projects send supply + installation; the server keeps rate = their sum.
        ...(split
          ? { supplyRate: parseNumber(form.supplyRate) ?? 0, installationRate: parseNumber(form.installationRate) ?? 0 }
          : { rate: parseNumber(form.rate) ?? 0 }),
        remarks: form.remarks.trim(),
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

  const qty = parseNumber(form.quantity) ?? 0;
  const amt = (r: string) => formatMoney(qty * (parseNumber(r) ?? 0));
  const input = (k: keyof ItemForm, label: string, testID: string, width: number, num = false) => ({ k, label, testID, width, num });
  // Same column order and names as the BOQ sheet; totals are worked out as you type.
  const cells: Array<ReturnType<typeof input> | { label: string; width: number; value: string; testID: string }> = [
    input('serialNo', 'SR. NO.', 'bi-serial', 70),
    input('description', 'Description', 'bi-desc', 300),
    input('quantity', 'Qty', 'bi-qty', 90, true),
    input('unit', 'Unit', 'bi-unit', 80),
    ...(split
      ? [
          input('supplyRate', 'Unit supply rate (₹)', 'bi-supply-rate', 130, true),
          input('installationRate', 'Unit install. rate (₹)', 'bi-installation-rate', 130, true),
          { label: 'Total supply', width: 125, value: amt(form.supplyRate), testID: 'bi-total-supply' },
          { label: 'Total install.', width: 125, value: amt(form.installationRate), testID: 'bi-total-install' },
          { label: 'Total', width: 125, value: formatMoney(qty * ((parseNumber(form.supplyRate) ?? 0) + (parseNumber(form.installationRate) ?? 0))), testID: 'bi-total' },
        ]
      : [input('rate', 'SITC rate (₹)', 'bi-rate', 130, true), { label: 'Total', width: 125, value: amt(form.rate), testID: 'bi-total' }]),
    input('remarks', 'Remarks', 'bi-remarks', 200),
  ];
  const shownErrors = cells.flatMap((c) => ('k' in c && errors[c.k] ? [{ ...c, message: errors[c.k] as string }] : []));

  return (
    <View style={styles.box} testID="boq-item-form">
      <Text style={styles.title}>{initial ? `Edit item ${initial.serialNo}` : 'Add BOQ item'}</Text>
      {error ? <ErrorBanner message={error} testID="boq-item-error" /> : null}
      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.row, styles.head]}>
            {cells.map((c) => <Text key={c.label} style={[styles.th, { width: c.width }]}>{c.label}</Text>)}
          </View>
          <View style={styles.row}>
            {cells.map((c) => ('k' in c ? (
              <TextInput
                key={c.label}
                testID={c.testID}
                accessibilityLabel={c.label}
                value={form[c.k]}
                onChangeText={set(c.k)}
                keyboardType={c.num ? 'decimal-pad' : 'default'}
                maxLength={c.k === 'remarks' ? 500 : undefined}
                placeholder={c.k === 'unit' ? 'Nos' : undefined}
                placeholderTextColor="#94A3B8"
                style={[styles.input, { width: c.width }, c.num && styles.right, errors[c.k] ? styles.inputError : null]}
              />
            ) : (
              <Text key={c.label} style={[styles.td, styles.right, { width: c.width }]} testID={c.testID}>{c.value}</Text>
            )))}
          </View>
        </View>
      </ScrollView>
      {shownErrors.map((e) => <Text key={e.label} style={styles.error} testID={`${e.testID}-error`}>{e.label}: {e.message}</Text>)}
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
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  head: { backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 13, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  td: { fontSize: 14, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 10, backgroundColor: colors.surfaceAlt },
  input: { fontSize: 14, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: 10, borderRightWidth: 1, borderRightColor: colors.border },
  inputError: { backgroundColor: '#FEF2F2', borderColor: colors.danger, borderWidth: 1 },
  right: { textAlign: 'right' },
  error: { fontSize: 13, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  danger: { backgroundColor: colors.danger },
});
