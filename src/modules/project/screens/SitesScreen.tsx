import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { TextField } from '../../../shared/ui/TextField';
import { useData } from '../../inventory/ui';
import { projectApi } from '../api/projectApi';
import type { SiteRow } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Sites'>;

const COLS: [string, number, (s: SiteRow) => string][] = [
  ['Project', 230, (s) => `${s.projectCode} · ${s.projectName}`],
  ['Site', 180, (s) => `${s.code} · ${s.name}`],
  ['Site engineer', 150, (s) => s.engineer?.name ?? 'Not assigned'],
  ['Address', 240, (s) => s.address || '—'],
  ['Status', 100, (s) => (s.isMain ? 'Main site' : s.isActive ? 'Open' : 'Closed')],
  ['Open requests', 110, (s) => String(s.openRequests)],
];

// Every site the person may reach, across projects; tap one to open its details.
export function SitesScreen({ navigation }: Props) {
  const fetcher = useCallback(() => projectApi.allSites(), []);
  const { data, error, reload } = useData(fetcher);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = (data ?? []).filter((s) => !term || COLS.some(([, , v]) => v(s).toLowerCase().includes(term)));

  return (
    <AppScreen title="Sites" subtitle="All sites of your projects" onBack={() => navigation.navigate('Dashboard')} testID="sites-screen">
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      <TextField label="Search" value={q} onChangeText={setQ} placeholder="Project, site, engineer or address" testID="sites-search" />
      {data && !rows.length ? <EmptyState title={data.length ? 'No site matches' : 'No sites yet'} /> : null}
      {rows.length ? (
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={[styles.row, styles.head]}>{COLS.map(([label, w]) => <Text key={label} style={[styles.th, { width: w }]}>{label}</Text>)}</View>
            {rows.map((s) => (
              <Pressable key={s.id} onPress={() => navigation.navigate('SiteDetail', { projectId: s.projectId, siteId: s.id })} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" testID={`sites-row-${s.projectCode}-${s.code}`}>
                {COLS.map(([label, w, v]) => <Text key={label} style={[styles.td, { width: w }, label === 'Site' && styles.link]} numberOfLines={2}>{v(s)}</Text>)}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: spacing.sm + 2, fontSize: 13, fontWeight: '700', color: colors.text },
  td: { padding: spacing.sm + 2, fontSize: 14, color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  pressed: { backgroundColor: colors.surfaceAlt },
});
