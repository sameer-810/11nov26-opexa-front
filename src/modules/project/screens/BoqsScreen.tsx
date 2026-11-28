import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { Icon } from '../../../shared/ui/Icon';
import { TextField } from '../../../shared/ui/TextField';
import { useData } from '../../inventory/ui';
import { projectApi } from '../api/projectApi';
import { BoqTable } from '../components/BoqTable';
import type { BoqView } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Boqs'>;

// Every project's BOQ in one place: tap a project to open its BOQ table; several can be open at once.
export function BoqsScreen({ navigation }: Props) {
  const fetcher = useCallback(() => projectApi.list(), []);
  const { data, error, reload } = useData(fetcher);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, BoqView | 'loading' | { error: string }>>({});
  const term = q.trim().toLowerCase();
  const projects = (data ?? []).filter((p) => !term || `${p.code} ${p.name} ${p.clientName}`.toLowerCase().includes(term));

  const toggle = async (id: string) => {
    if (open[id]) { setOpen(({ [id]: _closed, ...rest }) => rest); return; }
    setOpen((o) => ({ ...o, [id]: 'loading' }));
    try { const v = await projectApi.boqView(id); setOpen((o) => ({ ...o, [id]: v })); } catch (e) { setOpen((o) => ({ ...o, [id]: { error: e instanceof Error ? e.message : 'Could not load the BOQ' } })); }
  };

  return (
    <AppScreen title="BOQ" subtitle="Every project's work order; open as many as you need" onBack={() => navigation.navigate('Dashboard')} testID="boqs-screen">
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      <View style={styles.tools}>
        <View style={styles.flex}><TextField label="Search projects" value={q} onChangeText={setQ} placeholder="Code, project or client" testID="boqs-search" /></View>
        {projects.length ? <Button title="Close all" variant="ghost" onPress={() => setOpen({})} testID="boqs-close-all" /> : null}
      </View>
      {data && !projects.length ? <EmptyState title={data.length ? 'No project matches' : 'No projects yet'} /> : null}
      {projects.map((p) => {
        const v = open[p.id];
        return (
          <View key={p.id} style={styles.card}>
            <Pressable onPress={() => void toggle(p.id)} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: Boolean(v) }} testID={`boqs-toggle-${p.code}`}>
              <Icon name={v ? 'chevronDown' : 'chevronRight'} size={18} color={colors.textMuted} />
              <View style={styles.flex}>
                <Text style={styles.title}><Text style={styles.code}>{p.code}</Text>  {p.name}</Text>
                <Text style={styles.muted}>{p.clientName} · {p.boqItemCount} BOQ item{p.boqItemCount === 1 ? '' : 's'} · {formatMoney(p.boqValue)}</Text>
              </View>
              <Button title="Open project" variant="ghost" onPress={() => navigation.navigate('ProjectDetail', { id: p.id })} testID={`boqs-open-${p.code}`} />
            </Pressable>
            {v === 'loading' ? <Text style={styles.muted}>Loading…</Text> : null}
            {v && typeof v === 'object' && 'error' in v ? <ErrorBanner message={v.error} /> : null}
            {v && typeof v === 'object' && 'lines' in v ? (
              v.lines.length ? <View testID={`boqs-table-${p.code}`}><BoqTable columns={v.columns} lines={v.lines} onPressItem={() => navigation.navigate('ProjectDetail', { id: p.id })} /></View>
                : <Text style={styles.muted}>No BOQ lines yet.</Text>
            ) : null}
          </View>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tools: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  code: { color: colors.primary, fontWeight: '800' },
  muted: { fontSize: 13, color: colors.textMuted },
});
