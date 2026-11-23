import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../../shared/format';
import { colors, spacing } from '../../../shared/designSystem';
import { ROLE_LABEL } from '../../team/types';
import type { Role } from '../../auth/types';
import type { HistoryEntry } from '../api/approvalApi';

const DECISION: Record<HistoryEntry['action'], string> = {
  submitted: 'Sent for approval', resubmitted: 'Resubmitted', approved: 'Approved', rejected: 'Rejected', sent_back: 'Sent back', skipped: 'Skipped', escalated: 'Escalated',
};
const TONE: Partial<Record<HistoryEntry['action'], string>> = { approved: colors.success, rejected: colors.danger, sent_back: '#B45309' };
export const roleName = (r: string | null | undefined) => (r ? ROLE_LABEL[r as Role] ?? r.replace(/_/g, ' ') : '');

// Who did what on an approval, oldest first: decision, level role, person (and for whom), when, comment.
export function ApprovalHistory({ items, testID }: { items: HistoryEntry[]; testID?: string }) {
  if (!items.length) return null;
  return (
    <View style={styles.list} testID={testID}>
      {items.map((h, i) => (
        <View key={`${h.createdAt}-${i}`} style={styles.row} testID={testID ? `${testID}-${i}` : undefined}>
          <Text style={[styles.what, TONE[h.action] ? { color: TONE[h.action] } : null]}>
            {DECISION[h.action]}{h.levelRole ? ` · level ${h.sequence} (${roleName(h.levelRole)})` : ''}
          </Text>
          <Text style={styles.meta}>
            {[h.actorName && `${h.actorName}${h.actorRole ? `, ${roleName(h.actorRole)}` : ''}`, h.onBehalfOfName && `on behalf of ${h.onBehalfOfName}`, formatDateTime(h.createdAt)].filter(Boolean).join(' · ')}
          </Text>
          {h.comment ? <Text style={styles.comment}>{h.comment}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  row: { gap: 2 },
  what: { fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  comment: { fontSize: 13, color: colors.text, fontStyle: 'italic' },
});
