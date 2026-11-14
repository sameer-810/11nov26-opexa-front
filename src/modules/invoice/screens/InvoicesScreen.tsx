import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import type { Project } from '../../project/types';
import { invoiceApi, STATUS_LABEL, STATUS_TONE, type Billing, type Invoice } from '../invoiceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoices'>;
const FIELDS: [keyof Billing, string][] = [['legalName', 'Company legal name'], ['address', 'Address'], ['gstin', 'Our GSTIN'], ['state', 'State'], ['email', 'Email'], ['bankName', 'Bank'], ['bankAccount', 'Account no.'], ['ifsc', 'IFSC'], ['invoicePrefix', 'Invoice number prefix'], ['terms', 'Terms printed on invoice']];

export function InvoicesScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newFor, setNewFor] = useState('');
  const [billing, setBilling] = useState<Billing | null>(null);
  const [showBilling, setShowBilling] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [i, p, b] = await Promise.all([invoiceApi.list(), projectApi.list(), invoiceApi.billing()]);
      setRows(i);
      setProjects(p.filter((x) => x.status !== 'closed'));
      setBilling(b);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const saveBilling = async () => {
    if (!billing) return;
    setError('');
    try {
      setBilling(await invoiceApi.setBilling(billing));
      setSaved('Company billing details saved.');
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
  };

  return (
    <AppScreen title="Client invoices" subtitle="Bill delivered lots or installed work from the BOQ" onBack={() => navigation.navigate('Dashboard')} testID="invoices-screen">
      <View style={styles.box}>
        <Text style={styles.title}>New invoice</Text>
        {projects.length ? <ChoiceChips label="Project" value={newFor} onChange={setNewFor} testID="inv-new-project" options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} /> : <Text style={styles.muted}>No open projects.</Text>}
        <Button title="Start" onPress={() => newFor && navigation.navigate('InvoiceForm', { projectId: newFor })} disabled={!newFor} testID="inv-new" style={styles.self} />
      </View>
      <Button title="Company billing details" variant="ghost" onPress={() => setShowBilling((x) => !x)} testID="inv-billing-toggle" style={styles.self} />
      {showBilling && billing ? (
        <View style={styles.box}>
          {FIELDS.map(([k, label]) => <TextField key={k} label={label} value={billing[k]} onChangeText={(v) => setBilling({ ...billing, [k]: v })} testID={`bill-${k}`} />)}
          {error ? <ErrorBanner message={error} /> : null}
          <Button title="Save" onPress={saveBilling} testID="bill-save" style={styles.self} />
          {saved ? <Text style={styles.ok}>{saved}</Text> : null}
        </View>
      ) : null}
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!rows && !loadError ? <ActivityIndicator /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No invoices yet" /> : null}
      {rows?.map((i) => (
        <Pressable key={i.id} onPress={() => navigation.navigate('InvoiceDetail', { id: i.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`inv-row-${i.label}`}>
          <View style={styles.top}>
            <Text style={styles.title}>{i.label}</Text>
            <StatusChip label={STATUS_LABEL[i.status]} tone={STATUS_TONE[i.status]} />
          </View>
          <Text style={styles.muted}>{i.project.code} {i.project.name} · {formatDate(i.invoiceDate)} · {formatMoney(i.total)}</Text>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  self: { alignSelf: 'flex-start' },
});
