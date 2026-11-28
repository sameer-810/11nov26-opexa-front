import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatDate, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { useData } from '../../inventory/ui';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import { REQ_STATUS_LABEL } from '../../requisition/types';
import { projectApi } from '../api/projectApi';
import { SitePanel } from '../components/SitePanel';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteDetail'>;

// One site: where it is, its engineer and team, its material requests and the project BOQ with this site's usage.
export function SiteDetailScreen({ navigation, route }: Props) {
  const { projectId, siteId } = route.params;
  const { user } = useAuth();
  const manage = can(user, PERMS.PROJECT_MANAGE);
  const fetcher = useCallback(async () => {
    const [project, site, boq, usage, requests] = await Promise.all([
      projectApi.get(projectId), projectApi.site(projectId, siteId), projectApi.boqView(projectId),
      projectApi.siteUsage(projectId, siteId), requisitionApi.list({ projectId, siteId }).catch(() => []),
    ]);
    return { project, site, boq, usage: new Map(usage.map((u) => [u.workOrderItemId, u])), requests };
  }, [projectId, siteId]);
  const { data, error, reload } = useData(fetcher);
  const back = () => navigation.navigate('ProjectSites', { id: projectId });
  if (error) return <AppScreen title="Site" onBack={back}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  if (!data) return <AppScreen title="Site" onBack={back}><Text style={styles.muted}>Loading…</Text></AppScreen>;
  const { project, site, boq, usage, requests } = data;
  const n = (v: number | undefined) => (v ? formatNumber(v) : '—');

  return (
    <AppScreen
      title={`${site.code} · ${site.name}`}
      subtitle={`${project.code} · ${project.name}`}
      onBack={back}
      right={<Button title="Open project" variant="outline" onPress={() => navigation.navigate('ProjectDetail', { id: projectId })} testID="site-open-project" />}
      testID="site-detail-screen"
    >
      <View style={styles.facts}>
        <Fact label="Status" value={site.isMain ? 'Main site' : site.isActive ? 'Open' : 'Closed'} />
        <Fact label="Site engineer" value={site.engineer?.name ?? 'Not assigned'} testID="site-fact-engineer" />
        <Fact label="Address" value={site.address || '—'} />
        <Fact label="Location" value={site.location ? `${site.location.lat.toFixed(5)}, ${site.location.lng.toFixed(5)}` : 'Not set'} />
        <Fact label="Attendance radius" value={`${site.geofenceRadiusM} m`} />
        <Fact label="Open material requests" value={String(requests.filter((r) => r.status === 'pending_approval').length + requests.filter((r) => r.status === 'open').length)} testID="site-fact-requests" />
      </View>

      <Text style={styles.section}>BOQ · this site&apos;s use</Text>
      <Text style={styles.muted}>The BOQ belongs to the whole project. Requested, received (supplier lots checked in here) and installed are for this site only; store issues are booked to the project.</Text>
      <ScrollView horizontal>
        <View style={styles.table} testID="site-boq">
          <View style={[styles.row, styles.head]}>
            {COLS.map(([label, w]) => <Text key={label} style={[styles.th, { width: w }]}>{label}</Text>)}
          </View>
          {boq.lines.map((l) => {
            const u = usage.get(l.id);
            return (
              <View key={l.id} style={styles.row} testID={`site-boq-${l.serialNo}`}>
                {[l.serialNo, l.itemCode || '—', l.description, l.unit, formatNumber(l.quantity), n(u?.requested), n(u?.received), n(u?.installed)].map((v, i) => (
                  <Text key={COLS[i][0]} style={[styles.td, { width: COLS[i][1] }, i >= 4 && styles.num]} numberOfLines={2}>{v}</Text>
                ))}
              </View>
            );
          })}
          {!boq.lines.length ? <Text style={[styles.td, styles.muted]}>No BOQ lines yet.</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.headRow}>
        <Text style={styles.section}>Material requests for this site</Text>
        {can(user, PERMS.REQUISITION_CREATE) ? <Button title="New material request" variant="outline" onPress={() => navigation.navigate('NewRequisition', { projectId })} testID="site-new-request" /> : null}
      </View>
      {requests.length ? requests.map((r) => (
        <Pressable key={r.id} onPress={() => navigation.navigate('RequisitionDetail', { id: r.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`site-request-${r.number}`}>
          <View style={styles.cardTop}><Text style={styles.code}>{r.number}</Text><StatusChip label={REQ_STATUS_LABEL[r.status]} tone={r.status === 'open' ? 'success' : r.status === 'pending_approval' ? 'warning' : 'neutral'} /></View>
          <Text style={styles.muted}>{r.raisedBy.name} · {formatDate(r.createdAt)} · {r.lines.length} item{r.lines.length === 1 ? '' : 's'}</Text>
        </Pressable>
      )) : <Text style={styles.muted}>No material requests for this site yet.</Text>}

      <Text style={styles.section}>Engineer, team and activity</Text>
      <SitePanel projectId={projectId} siteId={siteId} manage={manage} onChanged={() => void reload()} />
    </AppScreen>
  );
}

const COLS: [string, number][] = [['SR. NO.', 70], ['Item code', 100], ['Description', 300], ['Unit', 70], ['BOQ qty', 90], ['Requested here', 110], ['Received here', 110], ['Installed here', 110]];

function Fact({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} testID={testID}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flexGrow: 1, flexBasis: 180, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  factLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  factValue: { fontSize: 15, color: colors.text, marginTop: 4 },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, color: colors.textMuted },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  th: { padding: 10, fontSize: 13, fontWeight: '700', color: colors.text },
  td: { padding: 10, fontSize: 14, color: colors.text },
  num: { textAlign: 'right' },
  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 15, fontWeight: '800', color: colors.primary },
  pressed: { backgroundColor: colors.surfaceAlt },
});
