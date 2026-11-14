import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { payrollApi, type RunSummary, type Settings } from '../payrollApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Payroll'>;
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function PayrollScreen({ navigation }: Props) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [month, setMonth] = useState(lastMonth());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [r, s] = await Promise.all([payrollApi.runs(), payrollApi.settings()]);
      setRuns(r);
      setSettings(s);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const create = async () => {
    setError('');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return setError('Month must be YYYY-MM, e.g. 2026-10');
    setBusy(true);
    try {
      const run = await payrollApi.createRun(month);
      navigation.navigate('PayrollRun', { id: run.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
    setBusy(false);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setError('');
    try {
      setSettings(await payrollApi.setSettings(settings));
      setSaved('Tally ledger names saved.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  };

  return (
    <AppScreen title="Payroll" subtitle="Monthly pay from attendance, with advances and Tally export" onBack={() => navigation.navigate('Dashboard')} testID="payroll-screen">
      <View style={styles.row}>
        <Button title="People & pay rates" variant="outline" onPress={() => navigation.navigate('PayrollPeople')} testID="payroll-people" />
        <Button title="Tally ledger names" variant="ghost" onPress={() => setShowSettings((x) => !x)} testID="payroll-settings" />
      </View>
      {showSettings && settings ? (
        <View style={styles.box}>
          <TextField label="Tally company name (optional)" value={settings.tallyCompany} onChangeText={(v) => setSettings({ ...settings, tallyCompany: v })} testID="tally-company" />
          <TextField label="Salary expense ledger" value={settings.salaryLedger} onChangeText={(v) => setSettings({ ...settings, salaryLedger: v })} testID="tally-salary" />
          <TextField label="Staff advance ledger" value={settings.advanceLedger} onChangeText={(v) => setSettings({ ...settings, advanceLedger: v })} testID="tally-advance" />
          <TextField label="Other deductions ledger" value={settings.deductionLedger} onChangeText={(v) => setSettings({ ...settings, deductionLedger: v })} testID="tally-deduction" />
          <TextField label="Salary payable ledger" value={settings.payableLedger} onChangeText={(v) => setSettings({ ...settings, payableLedger: v })} testID="tally-payable" />
          <Text style={styles.muted}>Each person's own ledger is set on "People & pay rates". Names must match your Tally ledgers exactly.</Text>
          <Button title="Save" onPress={saveSettings} testID="tally-save" style={styles.self} />
          {saved ? <Text style={styles.ok}>{saved}</Text> : null}
        </View>
      ) : null}

      <View style={styles.box}>
        <Text style={styles.title}>Make a payroll</Text>
        <TextField label="Month (YYYY-MM)" value={month} onChangeText={setMonth} testID="payroll-month" />
        {error ? <ErrorBanner message={error} testID="payroll-error" /> : null}
        <Button title="Calculate from attendance" onPress={create} loading={busy} testID="payroll-create" style={styles.self} />
      </View>

      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!runs && !loadError ? <ActivityIndicator /> : null}
      {runs?.map((r) => (
        <Pressable key={r.id} onPress={() => navigation.navigate('PayrollRun', { id: r.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`payroll-run-${r.month}`}>
          <View style={styles.top}>
            <Text style={styles.title}>{r.month}</Text>
            <StatusChip label={r.status === 'finalized' ? 'Finalized' : 'Draft'} tone={r.status === 'finalized' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.muted}>{r.people} people · Net pay {formatMoney(r.totals.net)}</Text>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  pressed: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  self: { alignSelf: 'flex-start' },
});
