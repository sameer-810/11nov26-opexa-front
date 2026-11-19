import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../shared/api/apiClient';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { ErrorBanner } from '../../shared/ui/Banner';
import { colors, radius, spacing } from '../../shared/designSystem';
import { vendorApi } from './api/vendorApi';
import type { Vendor, VendorInput } from './types';

const FIELDS = ['name', 'contactPerson', 'phone', 'email', 'gstin', 'pan', 'address', 'city', 'state', 'paymentTerms', 'category', 'materials', 'accountName', 'bankName', 'ifsc', 'accountNumber'] as const;
type Key = (typeof FIELDS)[number];
type Form = Record<Key, string>;
const BANK: Key[] = ['accountName', 'bankName', 'ifsc', 'accountNumber'];

export function VendorForm({ onSaved, onCancel }: { onSaved: (v: Vendor) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>(Object.fromEntries(FIELDS.map((k) => [k, ''])) as Form);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: Key) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const field = (k: Key, labelText: string, extra: object = {}) => (
    <View style={styles.cell}><TextField label={labelText} testID={`vf-${k}`} value={form[k]} onChangeText={set(k)} error={errors[k]} {...extra} /></View>
  );

  const save = async () => {
    if (form.name.trim().length < 2) return setErrors({ name: 'Enter the vendor name' });
    setBusy(true);
    setError('');
    try {
      const t = (k: Key) => form[k].trim() || undefined;
      const bank = Object.fromEntries(BANK.map((k) => [k, t(k)]).filter(([, v]) => v));
      const body: VendorInput = {
        name: form.name.trim(), contactPerson: t('contactPerson'), phone: t('phone'), email: t('email'), gstin: t('gstin'), pan: t('pan'), address: t('address'),
        city: t('city'), state: t('state'), paymentTerms: t('paymentTerms'), category: t('category'),
        materials: form.materials.split(',').map((m) => m.trim()).filter(Boolean),
        ...(Object.keys(bank).length ? { bank } : {}),
      };
      onSaved(await vendorApi.create(body));
    } catch (e) {
      if (e instanceof ApiError) {
        const fe: Partial<Form> = {};
        e.details.forEach((d) => { fe[d.field.replace(/^bank\./, '') as Key] = d.message; });
        setErrors(fe);
        setError(e.message);
      } else setError('Something went wrong');
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="vendor-form">
      <Text style={styles.title}>New supplier</Text>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.row}>{field('name', 'Supplier / company name')}{field('contactPerson', 'Contact person')}</View>
      <View style={styles.row}>{field('phone', 'Mobile', { keyboardType: 'phone-pad' })}{field('email', 'E-mail', { keyboardType: 'email-address', autoCapitalize: 'none' })}</View>
      <View style={styles.row}>{field('gstin', 'GSTIN', { autoCapitalize: 'characters' })}{field('pan', 'PAN', { autoCapitalize: 'characters' })}</View>
      <View style={styles.row}>{field('address', 'Office address')}{field('city', 'City')}{field('state', 'State')}</View>
      <View style={styles.row}>{field('category', 'Category (e.g. Copper, Ducting)')}{field('materials', 'Materials supplied (comma separated)')}{field('paymentTerms', 'Payment terms')}</View>
      <Text style={styles.sub}>Bank details (visible in full only to finance)</Text>
      <View style={styles.row}>{field('accountName', 'Account name')}{field('bankName', 'Bank')}{field('ifsc', 'IFSC', { autoCapitalize: 'characters' })}{field('accountNumber', 'Account number', { keyboardType: 'number-pad' })}</View>
      <View style={styles.row}>
        <Button title="Save supplier" onPress={save} loading={busy} testID="vf-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, backgroundColor: '#F8FAFF' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  cell: { flexGrow: 1, flexBasis: 220 },
});
