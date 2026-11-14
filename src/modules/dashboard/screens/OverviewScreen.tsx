import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { routeForLink } from '../../../navigation/routeForLink';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDateTime, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { overviewApi, type Overview } from '../api/overviewApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Overview'>;

// Short Indian style: ₹1.25 Cr, ₹4.5 L, else full rupees.
const short = (n: number) => (Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : formatMoney(n));

export function OverviewScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await overviewApi.get());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const open = (link: string) => {
    const t = routeForLink(link, user);
    if (t) (navigation.navigate as (n: string, p?: object) => void)(t.name, t.params);
  };

  return (
    <AppScreen title="Business overview" subtitle={data ? `Updated ${formatDateTime(data.asOf)}` : undefined} onBack={() => navigation.navigate('Dashboard')} testID="overview-screen">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {data ? (
        <>
          <View style={styles.tiles}>
            <Kpi label="Active projects" value={String(data.projects.active)} sub={data.projects.closing ? `${data.projects.closing} closing` : undefined} testID="kpi-projects" />
            <Kpi label="BOQ value (open jobs)" value={short(data.totals.boqValue)} testID="kpi-boq" />
            <Kpi label="Material installed" value={short(data.totals.installedValue)} sub={`supplied ${short(data.totals.suppliedValue)}`} testID="kpi-installed" />
            <Kpi label="Bought this month" value={short(data.month.purchaseValue + data.month.localPurchaseValue)} sub={`${data.month.purchaseOrders} PO · ${data.month.localPurchases} local`} testID="kpi-month" />
          </View>
          <View style={styles.tiles}>
            <Kpi small warn={data.material.requestsAwaitingPo > 0} label="Requests waiting for PO" value={String(data.material.requestsAwaitingPo)} testID="kpi-awaiting" />
            <Kpi small warn={data.material.requestsOverBoq > 0} label="Requests over BOQ" value={String(data.material.requestsOverBoq)} testID="kpi-overboq" />
            <Kpi small warn={data.material.lotsLate > 0} label="Deliveries late (2+ days)" value={`${data.material.lotsLate} / ${data.material.lotsInTransit}`} testID="kpi-late" />
            <Kpi small warn={data.material.returnsPending > 0} label="Returns to confirm" value={String(data.material.returnsPending)} testID="kpi-returns" />
            <Kpi small warn={data.material.stockShortValue30d > 0} label="Stock short (30 days)" value={short(data.material.stockShortValue30d)} testID="kpi-short" />
          </View>

          <Text style={styles.h2}>Needs your attention</Text>
          {data.attention.length === 0 ? <Text style={styles.muted} testID="attention-none">Nothing urgent. 👍</Text> : null}
          {data.attention.map((a, i) => (
            <Pressable key={i} onPress={() => open(a.link)} style={({ pressed }) => [styles.alert, pressed && styles.pressed]} testID={`attention-${i}`}>
              <Text style={styles.alertText}>{a.title}</Text>
              <Text style={styles.link}>Open ›</Text>
            </Pressable>
          ))}

          <Text style={styles.h2}>Projects</Text>
          <ScrollView horizontal>
            <View>
              <View style={[styles.tr, styles.head]}>
                {COLS.map(([h, w]) => <Text key={h} style={[styles.th, { width: w }]}>{h}</Text>)}
              </View>
              {data.projectRows.map((r) => (
                <Pressable key={r.id} onPress={() => navigation.navigate('ProjectDetail', { id: r.id })} style={styles.tr} testID={`ov-row-${r.code}`}>
                  <Text style={[styles.td, { width: COLS[0][1] }]}>{r.code} {r.name}</Text>
                  <Text style={[styles.td, styles.num, { width: COLS[1][1] }]}>{short(r.boqValue)}</Text>
                  <Text style={[styles.td, styles.num, { width: COLS[2][1] }]}>{short(r.suppliedValue)}</Text>
                  <View style={[styles.td, { width: COLS[3][1] }]}>
                    <Text style={styles.num}>{r.installedPct}%</Text>
                    <View style={styles.bar}><View style={[styles.fill, { width: `${Math.min(100, r.installedPct)}%` }]} /></View>
                  </View>
                  <Text style={[styles.td, styles.num, { width: COLS[4][1] }]}>{r.openRequests}</Text>
                  <Text style={[styles.td, styles.num, { width: COLS[5][1] }, r.lotsOverdue > 0 && styles.warnText]}>{r.lotsInTransit}{r.lotsOverdue ? ` (${r.lotsOverdue} late)` : ''}</Text>
                  <Text style={[styles.td, styles.num, { width: COLS[6][1] }, r.itemsOverBoq > 0 && styles.warnText]}>{r.itemsOverBoq}</Text>
                  <Text style={[styles.td, styles.num, { width: COLS[7][1] }]}>{short(r.localPurchaseValue)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.muted}>Installed % = value of material fixed at site ÷ BOQ value. Attendance and labour cost join this screen in later phases.</Text>
        </>
      ) : null}
    </AppScreen>
  );
}

const COLS = [['Project', 220], ['BOQ', 90], ['Supplied', 90], ['Installed', 120], ['Open requests', 90], ['On the way', 100], ['Over BOQ items', 90], ['Local buy', 90]] as const;

function Kpi({ label, value, sub, warn, small, testID }: { label: string; value: string; sub?: string; warn?: boolean; small?: boolean; testID: string }) {
  return (
    <View style={[styles.kpi, small && styles.kpiSmall, warn && styles.kpiWarn]} testID={testID}>
      <Text style={small ? styles.kpiValueSmall : styles.kpiValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minWidth: 160, flexGrow: 1, gap: 2 },
  kpiSmall: { minWidth: 140, padding: spacing.sm },
  kpiWarn: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  kpiValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  kpiValueSmall: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  alert: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: radius.md, padding: spacing.sm },
  pressed: { opacity: 0.7 },
  alertText: { fontSize: 14, color: colors.text, flex: 1 },
  link: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border, alignItems: 'center' },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  td: { padding: 8, fontSize: 14, color: colors.text },
  num: { textAlign: 'right', fontSize: 14, color: colors.text },
  warnText: { color: '#B45309', fontWeight: '700' },
  bar: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.success },
});
