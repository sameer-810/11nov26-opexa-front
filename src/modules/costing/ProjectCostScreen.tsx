import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ApiError } from '../../shared/api/apiClient';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, PERMS } from '../../shared/permissions';
import { formatDate, formatMoney, formatNumber, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../shared/designSystem';
import { CATEGORY_LABEL, costingApi, type Cost } from './costingApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectCost'>;

export function ProjectCostScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const mayAdd = can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.INVOICE_EDIT);
  const [c, setC] = useState<Cost | null>(null);
  const [form, setForm] = useState({ date: todayLocal(), category: 'transport', amount: '', note: '', billNo: '' });
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setC(await costingApi.detail(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const add = async () => {
    setError('');
    const amount = parseNumber(form.amount);
    if (!amount || amount <= 0) return setError('Enter the amount');
    setBusy(true);
    try {
      setC(await costingApi.addExpense(id, { date: form.date, category: form.category, amount, note: form.note.trim() || undefined, billNo: form.billNo.trim() || undefined }));
      setForm({ ...form, amount: '', note: '', billNo: '' });
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy(false);
  };

  if (!c) return <AppScreen title="Costing" onBack={() => navigation.goBack()}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;
  const Kpi = ({ label, value, tone, testID }: { label: string; value: string; tone?: 'good' | 'bad'; testID?: string }) => (
    <View style={styles.kpi} testID={testID}><Text style={[styles.kpiValue, tone === 'good' && styles.good, tone === 'bad' && styles.bad]}>{value}</Text><Text style={styles.muted}>{label}</Text></View>
  );
  return (
    <AppScreen title={`Costing · ${c.project.code}`} subtitle={`${c.project.name} · ${c.project.clientName}`} onBack={() => navigation.goBack()} testID="project-cost-screen">
      <View style={styles.kpis}>
        <Kpi label="Contract value (BOQ)" value={formatMoney(c.contractValue)} />
        <Kpi label="Billed (before GST)" value={formatMoney(c.billed)} testID="pc-billed" />
        <Kpi label="Total cost so far" value={formatMoney(c.totalCost)} testID="pc-cost" />
        <Kpi label={`Margin on billed${c.billed ? ` (${c.marginOnBilledPct}%)` : ''}`} value={formatMoney(c.marginOnBilled)} tone={c.marginOnBilled < 0 ? 'bad' : 'good'} testID="pc-margin" />
      </View>
      <Text style={styles.muted}>Material {formatMoney(c.materialCost)} · Labour {formatMoney(c.labourCost)} (estimated) · Other {formatMoney(c.otherCost)} · Work done at BOQ rates {formatMoney(c.installedValue)}</Text>
      {c.lossItems ? <Text style={styles.warn} testID="pc-loss">{c.lossItems} item{c.lossItems === 1 ? ' was' : 's were'} bought above the BOQ rate - every unit loses money.</Text> : null}
      {c.peopleWithoutRate ? <Text style={styles.warn}>{c.peopleWithoutRate} person/people worked here without pay details, so their labour cost shows as ₹0. Set it in Payroll → People & pay rates.</Text> : null}

      <Text style={styles.h2}>Material by item</Text>
      <ScrollView horizontal>
        <View>
          <View style={[styles.tr, styles.head]}>{[['S.No', 50], ['Item', 200], ['BOQ rate', 120], ['Bought at (avg)', 120], ['Per unit', 110], ['Net qty', 80], ['Cost', 130]].map(([h, w]) => <Text key={h} style={[styles.th, { width: w as number }]}>{h}</Text>)}</View>
          {c.items?.map((i) => (
            <View key={i.workOrderItemId} style={[styles.tr, i.lossItem && styles.lossRow]} testID={`pc-item-${i.serialNo}`}>
              <Text style={[styles.td, { width: 50 }]}>{i.serialNo}</Text>
              <Text style={[styles.td, { width: 200 }]}>{i.description}</Text>
              <Text style={[styles.td, styles.num, { width: 120 }]}>{formatMoney(i.boqRate)}</Text>
              <Text style={[styles.td, styles.num, { width: 120 }]}>{i.avgCost ? formatMoney(i.avgCost) : '—'}</Text>
              <Text style={[styles.td, styles.num, { width: 110 }, i.lossItem && styles.bad]}>{i.avgCost ? formatMoney(i.marginPerUnit) : '—'}</Text>
              <Text style={[styles.td, styles.num, { width: 80 }]}>{formatNumber(i.netQty)}</Text>
              <Text style={[styles.td, styles.num, { width: 130 }]}>{formatMoney(i.materialCost)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.h2}>Labour</Text>
      {c.labour?.length ? c.labour.map((l) => <Text key={l.userId} style={styles.text}>{l.name}: {l.hours} h · {formatMoney(l.cost)}{l.hasRate ? '' : ' (no pay rate set)'}</Text>) : <Text style={styles.muted}>No attendance at this site yet.</Text>}

      <Text style={styles.h2}>Other site expenses</Text>
      {c.expenses?.map((e) => (
        <View key={e.id} style={styles.exp} testID={`pc-exp-${e.id}`}>
          <Text style={styles.text}>{formatDate(e.date)} · {CATEGORY_LABEL[e.category] ?? e.category} · {formatMoney(e.amount)}{e.note ? ` · ${e.note}` : ''}{e.billNo ? ` (bill ${e.billNo})` : ''}</Text>
          {mayAdd ? <Text style={styles.link} onPress={async () => setC(await costingApi.removeExpense(id, e.id))}>Remove</Text> : null}
        </View>
      ))}
      {mayAdd ? (
        <View style={styles.box}>
          <ChoiceChips label="Type" value={form.category} onChange={(v) => setForm({ ...form, category: v })} testID="pc-cat" options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
          <View style={styles.row}>
            <View style={styles.cell}><TextField label="Amount ₹" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} testID="pc-amount" /></View>
            <View style={styles.cell}><TextField label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} testID="pc-date" /></View>
            <View style={styles.cell}><TextField label="Bill no." value={form.billNo} onChangeText={(v) => setForm({ ...form, billNo: v })} testID="pc-bill" /></View>
          </View>
          <TextField label="Note" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} testID="pc-note" />
          {error ? <ErrorBanner message={error} /> : null}
          <Button title="Add expense" onPress={add} loading={busy} testID="pc-add" style={styles.self} />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minWidth: 170, flexGrow: 1, gap: 2 },
  kpiValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  good: { color: colors.success },
  bad: { color: colors.danger },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  lossRow: { backgroundColor: '#FEF2F2' },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  td: { padding: 8, fontSize: 14, color: colors.text },
  num: { textAlign: 'right' },
  exp: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6 },
  link: { fontSize: 13, color: colors.danger },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 150 },
  self: { alignSelf: 'flex-start' },
});
