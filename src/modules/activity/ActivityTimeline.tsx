import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../shared/format';
import { colors, spacing } from '../../shared/designSystem';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorBanner } from '../../shared/ui/Banner';
import { errText, s } from '../inventory/ui';
import { activityApi, actionLabel, entityLabel, type ActivityEntry, type ActivityFilters, type AuditValue } from './activityApi';

const show = (v: AuditValue) => (v === null || v === '' ? '—' : String(v));
const roleText = (r: string | null) => (r ? ` (${r.replace(/_/g, ' ')})` : '');

// Who did what, when, in which role, and what changed (old -> new).
export function ActivityTimeline({ entries, showProject = false }: { entries: ActivityEntry[]; showProject?: boolean }) {
  return (
    <View style={s.list}>
      {entries.map((e) => (
        <View key={e.id} style={[s.card, styles.entry]} testID={`activity-${e.id}`}>
          <View style={s.row}>
            <Text style={s.number}>{entityLabel(e.entityType)}{e.entityNumber ? ` ${e.entityNumber}` : ''}</Text>
            <Text style={s.title}>{actionLabel(e.action)}</Text>
            {showProject && e.project ? <Text style={s.muted}>{e.project.code}</Text> : null}
          </View>
          <Text style={s.muted}>
            {e.user?.name ?? 'System'}{roleText(e.user?.role ?? null)} · {formatDateTime(e.at)}
          </Text>
          {e.changes.map((c, i) => (
            <Text key={`${c.field}-${i}`} style={styles.change} testID={`activity-${e.id}-change-${i}`}>
              {c.field}: {show(c.old)} → {show(c.new)}
            </Text>
          ))}
          {e.remarks ? <Text style={s.muted}>{e.remarks}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  change: { fontSize: 13, color: colors.text, marginLeft: spacing.sm },
});

const PAGE = 30;

// Loads the activity for some filters, newest first, 30 at a time ("Load more").
// Callers give it key={JSON.stringify(filters)} so new filters start again from page 1.
export function ActivityFeed({ filters, showProject = false }: { filters: ActivityFilters; showProject?: boolean }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [problem, setProblem] = useState('');
  const key = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    const f: ActivityFilters = JSON.parse(key);
    setBusy(true);
    setProblem('');
    activityApi.list({ ...f, page, limit: PAGE })
      .then((r) => { if (live) { setEntries((cur) => (page === 1 ? r.items : [...cur, ...r.items])); setTotal(r.total); } })
      .catch((e: unknown) => { if (live) setProblem(errText(e)); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [key, page]);

  return (
    <View style={s.list}>
      {problem ? <ErrorBanner message={problem} testID="activity-problem" /> : null}
      {!busy && !problem && entries.length === 0 ? <EmptyState title="No activity found" body="Changes to records show here: who, when and what changed." /> : null}
      {entries.length ? <Text style={s.muted} testID="activity-count">Showing {entries.length} of {total}</Text> : null}
      <ActivityTimeline entries={entries} showProject={showProject} />
      {busy ? <ActivityIndicator /> : null}
      {!busy && entries.length < total ? <Button title="Load more" variant="outline" onPress={() => setPage((p) => p + 1)} testID="activity-more" /> : null}
    </View>
  );
}
