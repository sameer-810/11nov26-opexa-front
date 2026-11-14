import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { PAY_TYPE_LABEL, payrollApi, type Employee, type PayType } from '../payrollApi';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollPeople'>;
const empty = { payType: 'daily' as PayType, rate: '', otRatePerHour: '0', fixedAllowance: '0', employeeCode: '', tallyLedger: '' };
const today = () => todayLocal();

export function PayrollPeopleScreen({ navigation }: Props) {
  const [rows, setRows] = useState<Employee[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [adv, setAdv] = useState({ amount: '', date: today(), note: '' });
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setRows(await payrollApi.employees());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const open = (e: Employee) => {
    setOpenId(openId === e.user.id ? null : e.user.id);
    setForm(e.profile ? { payType: e.profile.payType, rate: String(e.profile.rate), otRatePerHour: String(e.profile.otRatePerHour), fixedAllowance: String(e.profile.fixedAllowance), employeeCode: e.profile.employeeCode, tallyLedger: e.profile.tallyLedger } : empty);
    setAdv({ amount: '', date: today(), note: '' });
    setError('');
    setMessage('');
  };

  const save = async (userId: string) => {
    setError('');
    const rate = parseNumber(form.rate);
    const ot = parseNumber(form.otRatePerHour);
    const allow = parseNumber(form.fixedAllowance);
    if (rate === null || rate < 0) return setError('Enter the pay rate');
    if (ot === null || allow === null) return setError('Enter 0 if there is no overtime rate or allowance');
    setBusy('save');
    try {
      await payrollApi.setProfile(userId, { payType: form.payType, rate, otRatePerHour: ot, fixedAllowance: allow, employeeCode: form.employeeCode.trim() || undefined, tallyLedger: form.tallyLedger.trim() || undefined });
      setMessage('Pay details saved.');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
    setBusy('');
  };

  const giveAdvance = async (userId: string) => {
    setError('');
    const amount = parseNumber(adv.amount);
    if (!amount || amount <= 0) return setError('Enter the advance amount');
    setBusy('adv');
    try {
      await payrollApi.addAdvance({ userId, amount, date: adv.date, note: adv.note.trim() || undefined });
      setMessage(`Advance of ${formatMoney(amount)} recorded. It will be recovered in the next payroll.`);
      setAdv({ amount: '', date: today(), note: '' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
    setBusy('');
  };

  const rateLabel = { monthly: 'Salary per month ₹', daily: 'Wage per day ₹', hourly: 'Pay per hour ₹' }[form.payType];
  return (
    <AppScreen title="People & pay rates" subtitle="How each person is paid. People without pay details are not in payroll." onBack={() => navigation.navigate('Payroll')} testID="payroll-people-screen">
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!rows && !loadError ? <ActivityIndicator /> : null}
      {rows?.map((e) => (
        <View key={e.user.id} style={styles.card} testID={`pp-${e.user.name}`}>
          <Pressable onPress={() => open(e)} testID={`pp-open-${e.user.name}`}>
            <Text style={styles.title}>{e.user.name}</Text>
            <Text style={styles.muted}>
              {e.profile ? `${PAY_TYPE_LABEL[e.profile.payType]} ${formatMoney(e.profile.rate)}${e.profile.otRatePerHour ? ` · OT ${formatMoney(e.profile.otRatePerHour)}/h` : ''}` : 'No pay details yet - tap to add'}
              {e.advanceOutstanding ? ` · advance due ${formatMoney(e.advanceOutstanding)}` : ''}
            </Text>
          </Pressable>
          {openId === e.user.id ? (
            <View style={styles.gap}>
              <ChoiceChips label="Paid by" value={form.payType} onChange={(v) => setForm({ ...form, payType: v as PayType })} testID="pp-type"
                options={(['monthly', 'daily', 'hourly'] as PayType[]).map((t) => ({ value: t, label: PAY_TYPE_LABEL[t] }))} />
              <View style={styles.row}>
                <View style={styles.cell}><TextField label={rateLabel} value={form.rate} onChangeText={(v) => setForm({ ...form, rate: v })} testID="pp-rate" /></View>
                <View style={styles.cell}><TextField label="Overtime ₹ per hour (0 = none)" value={form.otRatePerHour} onChangeText={(v) => setForm({ ...form, otRatePerHour: v })} testID="pp-ot" /></View>
                <View style={styles.cell}><TextField label="Fixed allowance ₹ / month" value={form.fixedAllowance} onChangeText={(v) => setForm({ ...form, fixedAllowance: v })} testID="pp-allow" /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.cell}><TextField label="Employee code (optional)" value={form.employeeCode} onChangeText={(v) => setForm({ ...form, employeeCode: v })} testID="pp-code" /></View>
                <View style={styles.cell}><TextField label="Tally ledger name (optional)" value={form.tallyLedger} onChangeText={(v) => setForm({ ...form, tallyLedger: v })} placeholder={e.user.name} testID="pp-ledger" /></View>
              </View>
              <Button title="Save pay details" onPress={() => save(e.user.id)} loading={busy === 'save'} testID="pp-save" style={styles.self} />
              <Text style={styles.sub}>Give an advance</Text>
              <View style={styles.row}>
                <View style={styles.cell}><TextField label="Amount ₹" value={adv.amount} onChangeText={(v) => setAdv({ ...adv, amount: v })} testID="pp-adv-amount" /></View>
                <View style={styles.cell}><TextField label="Date (YYYY-MM-DD)" value={adv.date} onChangeText={(v) => setAdv({ ...adv, date: v })} testID="pp-adv-date" /></View>
                <View style={styles.cell}><TextField label="Note" value={adv.note} onChangeText={(v) => setAdv({ ...adv, note: v })} testID="pp-adv-note" /></View>
              </View>
              <Button title="Record advance" variant="outline" onPress={() => giveAdvance(e.user.id)} loading={busy === 'adv'} testID="pp-adv-save" style={styles.self} />
              {error ? <ErrorBanner message={error} testID="pp-error" /> : null}
              {message ? <Text style={styles.ok} testID="pp-message">{message}</Text> : null}
            </View>
          ) : null}
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 160 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, color: colors.textMuted },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  self: { alignSelf: 'flex-start' },
});
