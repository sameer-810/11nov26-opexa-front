import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import type { IconName } from '../../../shared/ui/Icon';
import { formatShortMoney as short } from '../../../shared/format';
import { glass } from '../../../shared/designSystem';
import { roleDashboardApi, type DirectorProject, type Kpi, type RoleDashboard as Board, type RoleKey, type RoleList } from '../api/roleDashboardApi';
import { BarList } from './charts';
import { Panel, StatCard } from './widgets';

const TINTS = [glass.indigo, glass.sky, glass.violet, glass.pink, glass.green, glass.amber];
const ICONS: Record<RoleKey, IconName> = { director: 'chart', project_manager: 'folder', purchaser: 'cart', store: 'box', accounts: 'rupee', hr: 'users', service_head: 'tool' };
const show = (k: Kpi) => (k.format === 'money' ? short(k.value) : k.format === 'pct' ? `${k.value}%` : String(k.value));
const isDirectorRow = (p: object): p is DirectorProject => 'estimatedProfit' in p;

// The signed-in user's role dashboard (5E); a picker when they may open more than one (owners, directors).
export function RoleDashboard({ onDrill }: { onDrill: (target: Kpi['drill']) => void }) {
  const [list, setList] = useState<RoleList | null>(null);
  const [role, setRole] = useState<RoleKey | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    roleDashboardApi.list().then((l) => { setList(l); setRole(l.default); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (!role) return;
    setBoard(null);
    roleDashboardApi.get(role).then(setBoard).catch(() => setFailed(true));
  }, [role]);

  if (!list?.dashboards.length || failed) return null;
  const projects = board?.projects ?? [];
  return (
    <View style={styles.wrap} testID="role-dashboard">
      {list.dashboards.length > 1 ? (
        <ChoiceChips label="Dashboard" options={list.dashboards.map((d) => ({ value: d.key, label: d.label }))} value={role ?? ''} onChange={(v) => setRole(v as RoleKey)} testID="role-picker" />
      ) : null}
      {board ? (
        <>
          <Text style={styles.h2} accessibilityRole="header" testID="role-title">{board.label} dashboard</Text>
          <View style={styles.row}>
            {board.kpis.map((k, i) => (
              <StatCard key={k.key} icon={ICONS[board.role]} tint={TINTS[i % TINTS.length]} label={k.label} value={show(k)} sub={k.sub} onPress={() => onDrill(k.drill)} testID={`role-kpi-${k.key}`} />
            ))}
          </View>
          {board.cashFlow ? (
            <Panel icon="wallet" title="Cash flow, next 90 days" testID="role-cashflow">
              {board.cashFlow.map((w, i) => (
                <View key={w.days} style={styles.cash} testID={`cash-${w.days}`}>
                  <Text style={styles.td}>{i === 0 ? 'Next 30 days' : `${w.days - 29}–${w.days} days`}</Text>
                  <BarList rows={[
                    { label: 'Expected receipts', value: w.receipts, display: short(w.receipts), icon: 'arrowDown', color: glass.green },
                    { label: 'Supplier bills due', value: w.payables, display: short(w.payables), icon: 'arrowUp', color: glass.pink },
                    { label: 'Payroll (estimate)', value: w.payroll, display: short(w.payroll), icon: 'users', color: glass.amber },
                  ]} />
                  <Text style={[styles.small, { color: w.net >= 0 ? glass.green : glass.pink }]}>Net {short(w.net)}</Text>
                </View>
              ))}
              {board.notes?.map((n) => <Text key={n} style={styles.small}>{n}</Text>)}
            </Panel>
          ) : null}
          {projects.length ? (
            <Panel icon="folder" title="Projects" testID="role-projects">
              {projects.map((p) => (
                <Pressable key={p.id} style={styles.tr} onPress={() => onDrill({ screen: 'ProjectDetail', params: { id: p.id } })} testID={`role-project-${p.code}`}>
                  <Text style={[styles.td, styles.flex]} numberOfLines={1}>{p.code} · {p.name}</Text>
                  {isDirectorRow(p) ? (
                    <Text style={[styles.small, p.overrun && styles.warn]}>Est. {short(p.estimatedProfit)} · forecast {short(p.forecastProfit)}{p.overrun ? ' · over estimate' : ''}</Text>
                  ) : <Text style={styles.small}>{p.installedPct}% installed</Text>}
                </Pressable>
              ))}
            </Panel>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  h2: { fontSize: 18, fontWeight: '700', color: glass.ink },
  cash: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderColor: glass.line },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: glass.line },
  flex: { flex: 1 },
  td: { fontSize: 14, color: glass.ink, fontWeight: '600' },
  small: { fontSize: 12, color: glass.inkMuted },
  warn: { color: '#B45309', fontWeight: '600' },
});
