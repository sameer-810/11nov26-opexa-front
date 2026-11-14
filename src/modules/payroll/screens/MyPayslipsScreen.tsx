import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { hours, payrollApi, type Payslip } from '../payrollApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Payslips'>;

export function MyPayslipsScreen({ navigation }: Props) {
  const [data, setData] = useState<{ advanceOutstanding: number; payslips: Payslip[] } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await payrollApi.myPayslips());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const row = (label: string, value: number, minus = false) => (value ? <View style={styles.line}><Text style={styles.text}>{label}</Text><Text style={styles.text}>{minus ? '− ' : ''}{formatMoney(value)}</Text></View> : null);
  return (
    <AppScreen title="My payslips" onBack={() => navigation.navigate('Dashboard')} testID="payslips-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {data && data.advanceOutstanding ? <Text style={styles.muted} testID="payslip-advance">Advance still to recover: {formatMoney(data.advanceOutstanding)}</Text> : null}
      {data && data.payslips.length === 0 ? <EmptyState title="No payslips yet" body="They appear here when the office finalizes the month's payroll." /> : null}
      {data?.payslips.map((p) => (
        <View key={p.month} style={styles.card} testID={`payslip-${p.month}`}>
          <Text style={styles.title}>{p.month}</Text>
          <Text style={styles.muted}>{p.daysPresent} days · {hours(p.workedMinutes)} h worked{p.otMinutes ? ` · ${hours(p.otMinutes)} h overtime` : ''}</Text>
          {row('Basic pay', p.basePay)}
          {row('Overtime', p.otPay)}
          {row('Allowance', p.allowance)}
          {p.adjustment ? row(p.adjustment > 0 ? 'Bonus / adjustment' : 'Adjustment', Math.abs(p.adjustment), p.adjustment < 0) : null}
          {row('Advance recovered', p.advanceDeduction, true)}
          {row('Other deduction', p.otherDeduction, true)}
          <View style={[styles.line, styles.total]}><Text style={styles.bold}>Net pay</Text><Text style={styles.bold}>{formatMoney(p.net)}</Text></View>
          {p.note ? <Text style={styles.muted}>Note: {p.note}</Text> : null}
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 6, marginTop: 4 },
  bold: { fontSize: 16, fontWeight: '800', color: colors.text },
});
