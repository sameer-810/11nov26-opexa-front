import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../../shared/format';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../api/requisitionApi';
import type { TimelineEvent } from '../types';
import { ROLE_LABEL } from '../../team/types';
import type { Role } from '../../auth/types';

const LABEL: Record<TimelineEvent['type'], string> = {
  created: 'Request raised',
  submitted: 'Sent for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  sent_back: 'Sent back for changes',
  resubmitted: 'Changed and resubmitted',
  skipped: 'Approval level skipped',
  cancelled: 'Cancelled',
  ordered: 'Purchase order raised',
  dispatched: 'Dispatched by supplier',
  received: 'Received at site',
  challan: 'Material received · delivery challan',
  challan_cancelled: 'Delivery challan cancelled',
};
const TONE: Partial<Record<TimelineEvent['type'], string>> = { approved: colors.success, received: colors.success, challan: colors.success, challan_cancelled: colors.danger, rejected: colors.danger, cancelled: colors.danger, sent_back: '#B45309' };
const role = (r: string | null | undefined) => (r ? ROLE_LABEL[r as Role] ?? r.replace(/_/g, ' ') : '');

// Who did what and when on a material request, oldest first. `version` reloads it after a change.
export function RequisitionTimeline({ requisitionId, version }: { requisitionId: string; version: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    requisitionApi.timeline(requisitionId).then((e) => { if (live) setEvents(e); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [requisitionId, version]);

  if (failed) return <Text style={styles.muted}>History could not be loaded.</Text>;
  if (!events) return null;
  return (
    <View style={styles.box} testID="req-timeline">
      <Text style={styles.title}>Status and history</Text>
      {events.map((e, i) => (
        <View key={`${e.type}-${i}`} style={styles.event} testID={`req-event-${i}`}>
          <View style={[styles.dot, { backgroundColor: TONE[e.type] ?? colors.primary }]} />
          <View style={styles.flex}>
            <Text style={styles.what}>
              {LABEL[e.type]}
              {e.level && e.type !== 'submitted' ? ` · level ${e.level}${e.levelRole ? ` (${role(e.levelRole)})` : ''}` : ''}
            </Text>
            <Text style={styles.muted}>{[e.by ? `${e.by.name}${e.by.role ? `, ${role(e.by.role)}` : ''}` : null, formatDateTime(e.at)].filter(Boolean).join(' · ')}</Text>
            {e.comment ? <Text style={styles.comment}>{e.comment}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  event: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  flex: { flex: 1, gap: 2 },
  what: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  comment: { fontSize: 13, color: colors.text },
});
