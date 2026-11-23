import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { saveBlob } from '../../../shared/download';
import { formatDate, formatMoney, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { approvalApi } from '../../approval/api/approvalApi';
import { errText, s } from '../../inventory/ui';
import { expenseApi, STATUS_LABEL, statusTone, type ExpenseReport, type ExpenseStatus, type ReportFilters } from '../expenseApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseReport'>;
type Option = { value: string; label: string };
const ALL = '';
const STATUSES: ExpenseStatus[] = ['submitted', 'sent_back', 'rejected', 'approved', 'paid', 'void'];

// Expense report: filters, totals by category and by project, Excel download.
export function ExpenseReportScreen({ navigation }: Props) {
  const [f, setF] = useState({ from: `${todayLocal().slice(0, 8)}01`, to: todayLocal(), status: ALL, projectId: ALL, category: ALL, employeeId: ALL });
  // The filters last shown; changing a field does not reload until "Show".
  const [applied, setApplied] = useState(f);
  const [options, setOptions] = useState<{ projects: Option[]; categories: Option[]; people: Option[] }>({ projects: [], categories: [], people: [] });
  const [data, setData] = useState<ExpenseReport | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    void Promise.all([projectApi.list(), expenseApi.categories(true), approvalApi.people()])
      .then(([p, c, u]) => setOptions({ projects: p.map((x) => ({ value: x.id, label: x.code })), categories: c.map((x) => ({ value: x.name, label: x.name })), people: u.map((x) => ({ value: x.id, label: x.name })) }))
      .catch((e: unknown) => setProblem(errText(e)));
  }, []);
  const filters = useCallback((): ReportFilters => ({ from: applied.from || undefined, to: applied.to || undefined, status: (applied.status || undefined) as ExpenseStatus | undefined, projectId: applied.projectId || undefined, category: applied.category || undefined, employeeId: applied.employeeId || undefined }), [applied]);
  const load = useCallback(async () => {
    setProblem(''); setBusy('load');
    try { setData(await expenseApi.report(filters())); } catch (e) { setProblem(errText(e)); } finally { setBusy(''); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);
  const download = async () => {
    setBusy('xlsx');
    try { if (!saveBlob(await expenseApi.reportExcel(filters()), `opexa-expenses-${applied.from || 'all'}-to-${applied.to || 'today'}.xlsx`)) setProblem('Open this on the web to download the Excel file.'); } catch (e) { setProblem(errText(e)); } finally { setBusy(''); }
  };
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const all = (label: string, rest: Option[]) => [{ value: ALL, label }, ...rest];

  return (
    <AppScreen title="Expense report" onBack={() => navigation.navigate('MyExpenses')} right={<Button title="Excel" variant="outline" onPress={() => void download()} loading={busy === 'xlsx'} testID="exp-report-excel" />} testID="expense-report-screen">
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={f.from} onChangeText={set('from')} testID="exp-report-from" /></View>
          <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={f.to} onChangeText={set('to')} testID="exp-report-to" /></View>
        </View>
        <ChoiceChips label="Status" value={f.status} onChange={set('status')} options={all('All', STATUSES.map((x) => ({ value: x, label: STATUS_LABEL[x] })))} testID="exp-report-status" />
        <ChoiceChips label="Project" value={f.projectId} onChange={set('projectId')} options={all('All', [{ value: 'office', label: 'Office' }, ...options.projects])} testID="exp-report-project" />
        <ChoiceChips label="Category" value={f.category} onChange={set('category')} options={all('All', options.categories)} testID="exp-report-category" />
        <ChoiceChips label="Employee" value={f.employeeId} onChange={set('employeeId')} options={all('Everyone', options.people)} testID="exp-report-employee" />
        <Button title="Show" onPress={() => setApplied(f)} loading={busy === 'load'} testID="exp-report-show" />
      </View>
      {problem ? <ErrorBanner message={problem} testID="exp-report-problem" /> : null}
      {!data && busy === 'load' ? <ActivityIndicator /> : null}
      {data ? (
        <>
          <Text style={s.title} testID="exp-report-total">{data.total.count} voucher(s) · {formatMoney(data.total.amount)} (void excluded)</Text>
          <View style={s.row}>
            <View style={[s.card, s.cell]} testID="exp-report-by-category">
              <Text style={s.title}>By category</Text>
              {data.byCategory.map((c) => <Text key={c.category} style={s.muted}>{c.category}: {formatMoney(c.amount)} ({c.count})</Text>)}
            </View>
            <View style={[s.card, s.cell]} testID="exp-report-by-project">
              <Text style={s.title}>By project</Text>
              {data.byProject.map((p) => <Text key={p.projectId ?? 'office'} style={s.muted}>{p.project}: {formatMoney(p.amount)} ({p.count})</Text>)}
            </View>
          </View>
          <View style={s.list}>
            {data.rows.map((e) => (
              <View key={e.id} style={s.card} testID={`exp-row-${e.number ?? e.id}`}>
                <View style={s.row}><Text style={s.number}>{e.number ?? 'Direct entry'}</Text><StatusChip label={STATUS_LABEL[e.status]} tone={statusTone(e.status)} /></View>
                <Text style={s.muted}>{formatDate(e.date)} · {e.employee?.name} · {e.projectCode ?? 'Office'} · {e.category} · {formatMoney(e.amount)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </AppScreen>
  );
}
