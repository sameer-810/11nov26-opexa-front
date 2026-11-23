import { StyleSheet, Text, View } from 'react-native';
import { formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { ApprovalLine, LineDecision } from '../api/approvalApi';

// Per line: quantity to approve (less than requested = reduced), or reject with a reason (Q11).
export type LineDraft = { qty: string; rejectReason: string | null };

export const draftsFor = (lines: ApprovalLine[]): Record<string, LineDraft> => Object.fromEntries(lines.map((l) => [l.id, { qty: String(l.qtyApproved), rejectReason: null }]));

// Only what changed is sent. Returns an error message instead when a rejected line has no reason.
export function decisionsFor(lines: ApprovalLine[], drafts: Record<string, LineDraft>): LineDecision[] | string {
  const out: LineDecision[] = [];
  for (const l of lines) {
    const d = drafts[l.id];
    if (!d || l.status === 'rejected') continue;
    if (d.rejectReason !== null) {
      if (d.rejectReason.trim().length < 3) return `Give a reason for rejecting S.No ${l.serialNo}`;
      out.push({ lineId: l.id, reject: true, rejectReason: d.rejectReason.trim() });
      continue;
    }
    const q = parseNumber(d.qty);
    if (q === null || q < 0) return `Enter a valid quantity for S.No ${l.serialNo}`;
    if (q === 0) return `To approve none of S.No ${l.serialNo}, reject it with a reason`;
    if (q !== l.qtyApproved) out.push({ lineId: l.id, qtyApproved: q });
  }
  return out;
}

type Props = { lines: ApprovalLine[]; drafts: Record<string, LineDraft>; onChange: (id: string, d: LineDraft) => void };

export function RequisitionLineDecisions({ lines, drafts, onChange }: Props) {
  return (
    <View style={styles.list}>
      {lines.map((l) => {
        const d = drafts[l.id] ?? { qty: String(l.qtyApproved), rejectReason: null };
        const rejecting = d.rejectReason !== null;
        return (
          <View key={l.id} style={[styles.line, rejecting && styles.rejecting]} testID={`approve-line-${l.serialNo}`}>
            <View style={styles.row}>
              <Text style={[styles.text, styles.flex]}>S.No {l.serialNo} {l.description}: requested {formatNumber(l.qtyRequested)} {l.unit}{l.overBy ? ` (over BOQ by ${formatNumber(l.overBy)})` : ''}</Text>
              {l.inBoq === false ? <StatusChip label="Not in BOQ" tone="neutral" /> : null}
              {l.newMaterial ? <StatusChip label="New – verify" tone="warning" testID={`approve-new-${l.serialNo}`} /> : null}
              {l.status === 'rejected' ? <StatusChip label="Rejected" tone="danger" /> : null}
            </View>
            {l.specification ? <Text style={styles.muted}>Spec: {l.specification}</Text> : null}
            {l.status === 'rejected' ? <Text style={styles.reason}>Rejected earlier: {l.rejectReason}</Text> : (
              <View style={styles.row}>
                {!rejecting ? <TextField label="Approve qty" value={d.qty} onChangeText={(v) => onChange(l.id, { ...d, qty: v })} keyboardType="decimal-pad" testID={`approve-qty-${l.serialNo}`} /> : (
                  <View style={styles.flex}><TextField label="Why reject this item?" value={d.rejectReason ?? ''} onChangeText={(v) => onChange(l.id, { ...d, rejectReason: v })} maxLength={300} testID={`reject-reason-${l.serialNo}`} /></View>
                )}
                <Button title={rejecting ? 'Keep item' : 'Reject item'} variant="ghost" onPress={() => onChange(l.id, { ...d, rejectReason: rejecting ? null : '' })} testID={`reject-line-${l.serialNo}`} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  line: { gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  rejecting: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flexGrow: 1, flexBasis: 200 },
  text: { color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  reason: { fontSize: 13, color: colors.danger },
});
