import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { saveBlob } from '../../../shared/download';
import { todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { colors, spacing } from '../../../shared/designSystem';
import { errText, s } from '../../inventory/ui';
import { projectApi } from '../../project/api/projectApi';
import { approvalApi } from '../../approval/api/approvalApi';
import { departmentApi } from '../../department/departmentApi';
import { attendanceApi } from '../api/attendanceApi';
import { hm, type AttendanceReport, type MusterCode, type ReportFilters } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AttendanceReport'>;
type Option = { value: string; label: string };
const ALL = '';
const CODE_COLOR: Record<MusterCode, string> = { P: '#166534', L: '#B45309', A: colors.danger, W: colors.textMuted };

// 1H: attendance by date range, employee, site and department, with the daily muster and an Excel download.
export function AttendanceReportScreen({ navigation }: Props) {
  const [f, setF] = useState({ from: `${todayLocal().slice(0, 8)}01`, to: todayLocal(), projectId: ALL, departmentId: ALL, userId: ALL, lateAfter: '09:30' });
  const [applied, setApplied] = useState(f);
  const [options, setOptions] = useState<{ projects: Option[]; departments: Option[]; people: Option[] }>({ projects: [], departments: [], people: [] });
  const [data, setData] = useState<AttendanceReport | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    void Promise.all([projectApi.list(), departmentApi.list(), approvalApi.people()])
      .then(([p, d, u]) => setOptions({ projects: p.map((x) => ({ value: x.id, label: x.code })), departments: d.map((x) => ({ value: x.id, label: x.name })), people: u.map((x) => ({ value: x.id, label: x.name })) }))
      .catch((e: unknown) => setProblem(errText(e)));
  }, []);
  const filters = useCallback((): ReportFilters => ({ from: applied.from, to: applied.to, projectId: applied.projectId || undefined, departmentId: applied.departmentId || undefined, userId: applied.userId || undefined, lateAfter: applied.lateAfter || undefined }), [applied]);
  const load = useCallback(async () => {
    setProblem(''); setBusy('load');
    try { setData(await attendanceApi.report(filters())); } catch (e) { setProblem(errText(e)); } finally { setBusy(''); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);
  const download = async () => {
    setBusy('xlsx');
    try { if (!saveBlob(await attendanceApi.reportExcel(filters()), `opexa-attendance-${applied.from}-to-${applied.to}.xlsx`)) setProblem('Open this on the web to download the Excel file.'); } catch (e) { setProblem(errText(e)); } finally { setBusy(''); }
  };
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const all = (label: string, rest: Option[]) => [{ value: ALL, label }, ...rest];

  return (
    <AppScreen title="Attendance report" onBack={() => navigation.navigate('TeamAttendance')} right={<Button title="Excel" variant="outline" onPress={() => void download()} loading={busy === 'xlsx'} testID="ar-excel" />} testID="attendance-report-screen">
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={f.from} onChangeText={set('from')} testID="ar-from" /></View>
          <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={f.to} onChangeText={set('to')} testID="ar-to" /></View>
          <View style={s.cell}><TextField label="Late after (HH:MM)" value={f.lateAfter} onChangeText={set('lateAfter')} testID="ar-late" /></View>
        </View>
        <ChoiceChips label="Site" value={f.projectId} onChange={set('projectId')} options={all('All', [{ value: 'office', label: 'Office' }, ...options.projects])} testID="ar-project" />
        <ChoiceChips label="Department" value={f.departmentId} onChange={set('departmentId')} options={all('All', options.departments)} testID="ar-department" />
        <ChoiceChips label="Employee" value={f.userId} onChange={set('userId')} options={all('Everyone', options.people)} testID="ar-employee" />
        <Button title="Show" onPress={() => setApplied(f)} loading={busy === 'load'} testID="ar-show" />
      </View>
      {problem ? <ErrorBanner message={problem} testID="ar-problem" /> : null}
      {!data && busy === 'load' ? <ActivityIndicator /> : null}
      {data ? (
        <>
          <Text style={s.title} testID="ar-totals">
            {data.totals.people} people · {data.totals.daysPresent} days present · {data.totals.lateDays} late · {data.totals.hours} h · {data.totals.outsideAttempts} refused outside the area · {data.totals.corrections} corrected
          </Text>
          <View style={s.list}>
            {data.rows.map((r) => (
              <View key={r.user.id} style={s.card} testID={`ar-row-${r.user.id}`}>
                <Text style={s.title}>{r.user.name}{r.user.department ? ` · ${r.user.department}` : ''}</Text>
                <Text style={s.muted}>
                  Present {r.daysPresent} · Absent {r.daysAbsent} · Late {r.lateDays} · {hm(r.totalMinutes)} · Outside-area check-ins {r.outsideAttempts} · Left before check-out {r.checkoutOutside} · Corrections {r.corrections}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.title}>Daily muster (P present, L late, A absent, W weekly off)</Text>
          <ScrollView horizontal testID="ar-muster">
            <View>
              <View style={styles.line}>
                <Text style={styles.name}>Employee</Text>
                {data.dates.map((d) => <Text key={d} style={styles.cell}>{d.slice(8)}</Text>)}
              </View>
              {data.muster.map((m) => (
                <View key={m.userId} style={styles.line} testID={`ar-muster-${m.userId}`}>
                  <Text style={styles.name}>{m.name}</Text>
                  {m.cells.map((c) => <Text key={c.date} style={[styles.cell, { color: CODE_COLOR[c.code] }]}>{c.code}</Text>)}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 },
  name: { width: 160, fontSize: 13, fontWeight: '600', color: colors.text, paddingRight: spacing.sm },
  cell: { width: 28, textAlign: 'center', fontSize: 13, fontWeight: '700' },
});
