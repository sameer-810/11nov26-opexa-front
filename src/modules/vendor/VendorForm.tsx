import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../shared/api/apiClient';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { ErrorBanner } from '../../shared/ui/Banner';
import { colors, radius, spacing } from '../../shared/designSystem';
import { vendorApi } from './api/vendorApi';
import type { Vendor, VendorInput } from './types';

type Form = Required<VendorInput>;

export function VendorForm({ onSaved, onCancel }: { onSaved: (v: Vendor) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>({ name: '', contactPerson: '', phone: '', email: '', gstin: '', address: '' });
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = async () => {
    if (form.name.trim().length < 2) return setErrors({ name: 'Enter the vendor name' });
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Form;
      onSaved(await vendorApi.create(body));
    } catch (e) {
      if (e instanceof ApiError) {
        const fe: Partial<Form> = {};
        e.details.forEach((d) => {
          fe[d.field as keyof Form] = d.message;
        });
        setErrors(fe);
        setError(e.message);
      } else setError('Something went wrong');
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="vendor-form">
      <Text style={styles.title}>New vendor</Text>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Vendor name" testID="vf-name" value={form.name} onChangeText={set('name')} error={errors.name} /></View>
        <View style={styles.cell}><TextField label="Contact person" value={form.contactPerson} onChangeText={set('contactPerson')} /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Phone" testID="vf-phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" /></View>
        <View style={styles.cell}><TextField label="GSTIN" value={form.gstin} onChangeText={set('gstin')} error={errors.gstin} autoCapitalize="characters" /></View>
      </View>
      <View style={styles.row}>
        <Button title="Save vendor" onPress={save} loading={busy} testID="vf-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, backgroundColor: '#F8FAFF' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  cell: { flexGrow: 1, flexBasis: 220 },
});
