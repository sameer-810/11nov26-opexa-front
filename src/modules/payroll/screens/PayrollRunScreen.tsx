import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDateTime, formatMoney, parseNumber } from '../../../shared/format';
import { saveBlob } from '../../../shared/download';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { hours, payrollApi, type Line, type Run } from '../payrollApi';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollRun'>;
const COLS = [['Name', 170], ['Days', 50], ['Hours', 60], ['OT h', 50], ['Basic', 90], ['OT', 70], ['Allow.', 70], ['Adj.', 70], ['Gross', 90], ['Advance', 80], ['Other', 70], ['Net', 90]] as const;

export function PayrollRunScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [run, setRun] = useState<Run | null>(null);
  const [edit, setEdit] = useState<Line | null>(null);
  const [form, setForm] = useState({ adjustment: '0', advanceDeduction: '0', otherDeduction: '0', note: '' });
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setRun(await payrollApi.run(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const act = async (key: string, fn: () => Promise<Run | void>) => {
    setError('');
    setBusy(key);
    try {
      const r = await fn();
      if (r) setRun(r);
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy('');
  };

  const openEdit = (l: Line) => {
    setEdit(l);
    setForm({ adjustment: String(l.adjustment), advanceDeduction: String(l.advanceDeduction), otherDeduction: String(l.otherDeduction), note: l.note });
    setError('');
  };
  const saveEdit = () => act('edit', async () => {
    const adj = parseNumber(form.adjustment);
    const adv = parseNumber(form.advanceDeduction);
    const oth = parseNumber(form.otherDeduction);
    if (adj === null || adv === null || oth === null) throw new ApiError('Enter numbers (0 if none)', 422, 'VALIDATION_ERROR');
    const r = await payrollApi.editLine(id, edit!.id, { adjustment: adj, advanceDeduction: adv, otherDeduction: oth, note: form.note.trim() });
    setEdit(null);
    return r;
  });
  const download = (kind: 'excel' | 'tally') => act(kind, async () => {
    const blob = kind === 'excel' ? await payrollApi.excel(id) : await payrollApi.tally(id);
    saveBlob(blob, kind === 'excel' ? `opexa-payroll-${run!.month}.xlsx` : `opexa-tally-salary-${run!.month}.xml`);
  });

  if (!run) return <AppScreen title="Payroll" onBack={() => navigation.navigate('Payroll')}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;
  const draft = run.status === 'draft';
  const flagged = run.lines.filter((l) => l.flaggedDays > 0);

  return (
    <AppScreen title={`Payroll ${run.month}`} subtitle={draft ? `Draft · calculated ${formatDateTime(run.calculatedAt)}` : `Finalized ${run.finalizedAt ? formatDateTime(run.finalizedAt) : ''}`} onBack={() => navigation.navigate('Payroll')} testID="payroll-run-screen">
      <View style={styles.row}>
        <StatusChip label={draft ? 'Draft' : 'Finalized'} tone={draft ? 'warning' : 'success'} testID="payroll-status" />
        <Text style={styles.big} testID="payroll-net">Net pay {formatMoney(run.totals.net)}</Text>
      </View>
      <Text style={styles.muted}>Gross {formatMoney(run.totals.gross)} · advances recovered {formatMoney(run.totals.advanceDeduction)} · other deductions {formatMoney(run.totals.otherDeduction)}</Text>
      {run.reopenReason && draft ? <Text style={styles.warn}>Reopened: {run.reopenReason}</Text> : null}
      {flagged.length ? <Text style={styles.warn} testID="payroll-flagged">Check attendance first: {flagged.map((l) => `${l.name} (${l.flaggedDays} day${l.flaggedDays === 1 ? '' : 's'})`).join(', ')} had missed check-outs or corrections.</Text> : null}

      <ScrollView horizontal>
        <View>
          <View style={[styles.tr, styles.head]}>{COLS.map(([h, w]) => <Text key={h} style={[styles.th, { width: w }]}>{h}</Text>)}</View>
          {run.lines.map((l) => {
            const v = [l.name, l.daysPresent, hours(l.workedMinutes), hours(l.otMinutes), formatMoney(l.basePay), formatMoney(l.otPay), formatMoney(l.allowance), formatMoney(l.adjustment), formatMoney(l.gross), formatMoney(l.advanceDeduction), formatMoney(l.otherDeduction), formatMoney(l.net)];
            return (
              <Pressable key={l.id} onPress={() => draft && openEdit(l)} style={[styles.tr, edit?.id === l.id && styles.sel]} testID={`payroll-line-${l.name}`}>
                {v.map((x, i) => <Text key={COLS[i][0]} style={[styles.td, { width: COLS[i][1] }, i > 0 && styles.num, i === 11 && styles.bold]}>{x}</Text>)}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {draft ? <Text style={styles.muted}>Tap a person to add a bonus/adjustment or change deductions.</Text> : null}

      {edit ? (
        <View style={styles.box} testID="payroll-edit">
          <Text style={styles.title}>{edit.name}</Text>
          <Text style={styles.muted}>Advance outstanding {formatMoney(edit.advanceOutstanding)}</Text>
          <View style={styles.row}>
            <View style={styles.cell}><TextField label="Adjustment ₹ (+ bonus / − other)" value={form.adjustment} onChangeText={(v) => setForm({ ...form, adjustment: v })} testID="pl-adjustment" /></View>
            <View style={styles.cell}><TextField label="Advance to recover ₹" value={form.advanceDeduction} onChangeText={(v) => setForm({ ...form, advanceDeduction: v })} testID="pl-advance" /></View>
            <View style={styles.cell}><TextField label="Other deduction ₹" value={form.otherDeduction} onChangeText={(v) => setForm({ ...form, otherDeduction: v })} testID="pl-other" /></View>
          </View>
          <TextField label="Note on payslip" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} testID="pl-note" />
          <View style={styles.row}>
            <Button title="Save" onPress={saveEdit} loading={busy === 'edit'} testID="pl-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setEdit(null)} />
          </View>
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} testID="payroll-run-error" /> : null}
      <View style={styles.row}>
        {draft ? <Button title="Recalculate from attendance" variant="outline" onPress={() => act('recalc', () => payrollApi.recalculate(id))} loading={busy === 'recalc'} testID="payroll-recalc" /> : null}
        {draft ? <Button title="Finalize" onPress={() => act('finalize', () => payrollApi.finalize(id))} loading={busy === 'finalize'} testID="payroll-finalize" /> : null}
        <Button title="Download Excel" variant="outline" onPress={() => download('excel')} loading={busy === 'excel'} testID="payroll-excel" />
        {!draft ? <Button title="Download for Tally (XML)" variant="outline" onPress={() => download('tally')} loading={busy === 'tally'} testID="payroll-tally" /> : null}
      </View>
      {!draft ? (
        <View style={styles.box}>
          <Text style={styles.muted}>Finalized payrolls are locked; staff can see their payslips. To change something, reopen it with a reason.</Text>
          <TextField label="Reason to reopen" value={reason} onChangeText={setReason} testID="payroll-reopen-reason" />
          <Button title="Reopen" variant="outline" onPress={() => act('reopen', () => payrollApi.reopen(id, reason.trim()))} loading={busy === 'reopen'} testID="payroll-reopen" style={styles.self} />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  cell: { flex: 1, minWidth: 160 },
  big: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  sel: { backgroundColor: '#EEF4FF' },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  td: { padding: 8, fontSize: 14, color: colors.text },
  num: { textAlign: 'right' },
  bold: { fontWeight: '800' },
  self: { alignSelf: 'flex-start' },
});
