import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatDateTime, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../api/requisitionApi';
import { LINE_STATUS_LABEL, PURCHASE_LABEL, REQ_STATUS_LABEL, type Requisition } from '../types';
import { AttachmentList } from '../components/Attachments';
import { RequisitionTimeline } from '../components/RequisitionTimeline';
import { challanApi } from '../../deliveryChallan/api/challanApi';
import { ChallanList } from '../../deliveryChallan/components/ChallanList';
import type { DeliveryChallan } from '../../deliveryChallan/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequisitionDetail'>;

export function RequisitionDetailScreen({ navigation, route }: Props) {
  const { id, justCreated, attachFailed } = route.params;
  const { user } = useAuth();
  const [req, setReq] = useState<Requisition | null>(null);
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setReq(await requisitionApi.get(id));
      setChallans(await challanApi.list({ requisitionId: id }).catch(() => []));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  // Reloaded when coming back from "Material received" or a challan.
  useFocusEffect(useCallback(() => void load(), [load]));

  const back = () => (req ? navigation.navigate('Requisitions', { projectId: req.projectId }) : navigation.navigate('Dashboard'));
  if (loadError) return <AppScreen title="Material request" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!req) return <AppScreen title="Material request" onBack={() => navigation.navigate('Dashboard')}><ActivityIndicator /></AppScreen>;

  const canCancel = req.status === 'open' && (req.raisedBy.id === user?.id || can(user, PERMS.PROJECT_MANAGE));
  // Site / store staff record material received on an approved request (Q7).
  const canReceive = req.status === 'open' && [PERMS.PROJECT_MANAGE, PERMS.STORE_MANAGE, PERMS.RECEIVING_RECORD].some((p) => can(user, p)) && req.lines.some((l) => (l.receivable ?? 0) > 0);
  const canResubmit = req.status === 'sent_back' && req.raisedBy.id === user?.id && can(user, PERMS.REQUISITION_CREATE);

  const doCancel = async () => {
    if (reason.trim().length < 3) return setReasonError('Give a reason');
    setBusy(true);
    setError('');
    try {
      setReq(await requisitionApi.cancel(id, reason.trim()));
      setCancelling(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen
      title={`Request ${req.number}`}
      subtitle={`${req.projectCode} · ${req.projectName} · by ${req.raisedBy.name} · ${formatDateTime(req.createdAt)}`}
      onBack={back}
      right={
        <View style={styles.row}>
          {req.overBoq ? <StatusChip label="Over BOQ" tone="danger" testID="req-over-chip" /> : null}
          <StatusChip
            label={req.status !== 'open' ? REQ_STATUS_LABEL[req.status] ?? req.status : req.purchaseStatus ? PURCHASE_LABEL[req.purchaseStatus] : 'Open'}
            tone={req.purchaseStatus === 'ordered' || req.purchaseStatus === 'received' ? 'success' : req.status === 'cancelled' ? 'neutral' : 'info'}
            testID="req-status"
          />
        </View>
      }
      testID="requisition-detail-screen"
    >
      {justCreated ? (
        <View style={styles.ok} testID="req-created">
          <Text style={styles.okText}>Request sent. The purchaser has been notified.</Text>
        </View>
      ) : null}
      {attachFailed ? <ErrorBanner message="The request was saved, but some attachments could not be uploaded." testID="req-attach-failed" /> : null}
      <View style={styles.info} testID="req-info">
        {req.deliveryAddress ? <Text style={styles.note}>Deliver to: {req.deliveryAddress}</Text> : null}
        {req.neededBy ? <Text style={styles.note}>Required by: {formatDate(req.neededBy)}</Text> : null}
        {req.note ? <Text style={styles.note}>Remarks: {req.note}</Text> : null}
      </View>
      {canResubmit ? (
        <View style={styles.backBox}>
          <Text style={styles.backText}>An approver sent this request back. See the history below, change it and resubmit.</Text>
          <Button title="Change and resubmit" onPress={() => navigation.navigate('NewRequisition', { projectId: req.projectId, requisitionId: req.id })} testID="req-resubmit" style={styles.self} />
        </View>
      ) : null}
      {req.status === 'cancelled' ? <Text style={styles.cancelled}>Cancelled: {req.cancelReason}</Text> : null}

      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.tr, styles.head]}>
            {['S.No', 'Item', 'Unit', 'BOQ', 'Earlier', 'This request', 'Approved', 'Over BOQ', 'Ordered', 'Dispatched', 'Received', 'Pending'].map((h, i) => (
              <Text key={h} style={[styles.th, { width: W[i] }, i > 2 && styles.right]}>{h}</Text>
            ))}
          </View>
          {req.lines.map((l) => (
            <View key={l.id} style={[styles.tr, l.overBy > 0 && styles.overRow, l.status === 'rejected' && styles.rejectedRow]} testID={`req-line-${l.serialNo}`}>
              <Text style={[styles.td, { width: W[0] }]}>{l.serialNo}</Text>
              <View style={{ width: W[1], padding: 8, gap: 2 }}>
                <Text style={styles.tdText}>{l.description}</Text>
                <View style={styles.row}>
                  {!l.workOrderItemId ? <StatusChip label="Not in BOQ" tone="neutral" /> : null}
                  {l.newMaterial ? <StatusChip label="New – verify" tone="warning" testID={`req-new-${l.serialNo}`} /> : null}
                  {l.status ? <StatusChip label={LINE_STATUS_LABEL[l.status]} tone={l.status === 'rejected' ? 'danger' : l.status === 'reduced' ? 'warning' : 'success'} testID={`req-line-status-${l.serialNo}`} /> : null}
                </View>
                {l.specification ? <Text style={styles.muted}>Spec: {l.specification}</Text> : null}
                {l.overrideReason ? <Text style={styles.reason}>Reason: {l.overrideReason}</Text> : null}
                {l.rejectReason ? <Text style={styles.reason}>Rejected: {l.rejectReason}</Text> : null}
              </View>
              <Text style={[styles.td, { width: W[2] }]}>{l.unit}</Text>
              <Text style={[styles.td, styles.right, { width: W[3] }]}>{formatNumber(l.boqQty)}</Text>
              <Text style={[styles.td, styles.right, { width: W[4] }]}>{formatNumber(l.previouslyRequested)}</Text>
              <Text style={[styles.td, styles.right, styles.bold, { width: W[5] }]}>{formatNumber(l.qtyRequested)}</Text>
              <Text style={[styles.td, styles.right, { width: W[6] }]}>{formatNumber(l.qtyApproved ?? l.qtyRequested)}</Text>
              <Text style={[styles.td, styles.right, { width: W[7] }, l.overBy > 0 && styles.over]}>{l.overBy > 0 ? `+${formatNumber(l.overBy)}` : '—'}</Text>
              <Text style={[styles.td, styles.right, { width: W[8] }]}>{formatNumber(l.ordered ?? 0)}</Text>
              <Text style={[styles.td, styles.right, { width: W[9] }]}>{formatNumber(l.dispatched ?? 0)}</Text>
              <Text style={[styles.td, styles.right, { width: W[10] }]}>{formatNumber(l.received ?? 0)}</Text>
              <Text style={[styles.td, styles.right, { width: W[11] }, (l.pending ?? 0) > 0 && styles.bold]} testID={`req-pending-${l.serialNo}`}>{l.status === 'rejected' ? '—' : formatNumber(l.pending ?? 0)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {can(user, PERMS.PURCHASE_MANAGE) && req.status === 'open' && req.lines.some((l) => (l.toOrder ?? 0) > 0) ? (
        <View style={styles.actions}>
          <Button title="Request quotations (RFQ)" onPress={() => navigation.navigate('NewRfq', { requisitionId: req.id })} testID="create-rfq" />
          <Button title="Create purchase order" variant="outline" onPress={() => navigation.navigate('NewPurchaseOrder', { requisitionId: req.id })} testID="create-po" />
        </View>
      ) : null}

      {canReceive ? (
        <Button title="Material received" onPress={() => navigation.navigate('MaterialReceived', { requisitionId: req.id })} testID="req-material-received" style={styles.self} />
      ) : null}
      {challans.length ? (
        <View style={styles.gap}>
          <Text style={styles.sectionTitle}>Delivery challans ({challans.length})</Text>
          <ChallanList items={challans} onOpen={(dc) => navigation.navigate('ChallanDetail', { id: dc.id })} testID="req-challans" />
        </View>
      ) : null}
      <AttachmentList items={req.attachments ?? []} onError={setError} fetchFile={(a) => requisitionApi.downloadAttachment(req.id, a)} />
      {error ? <ErrorBanner message={error} /> : null}
      {canCancel && !cancelling ? <Button title="Cancel this request" variant="outline" onPress={() => setCancelling(true)} testID="req-cancel" style={styles.self} /> : null}
      {cancelling ? (
        <View style={styles.cancelBox}>
          <TextField label="Why cancel?" value={reason} onChangeText={(v) => { setReason(v); setReasonError(''); }} error={reasonError} testID="req-cancel-reason" />
          <View style={styles.row}>
            <Button title="Yes, cancel request" onPress={doCancel} loading={busy} style={styles.danger} testID="req-cancel-confirm" />
            <Button title="Keep it" variant="ghost" onPress={() => setCancelling(false)} />
          </View>
        </View>
      ) : null}
      <RequisitionTimeline requisitionId={req.id} version={`${req.status}:${challans.map((c) => c.status).join(',')}`} />
    </AppScreen>
  );
}

const W = [80, 260, 60, 70, 70, 100, 90, 80, 80, 90, 90, 80];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  ok: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  okText: { color: '#065F46', fontWeight: '700' },
  note: { fontSize: 15, color: colors.text },
  cancelled: { fontSize: 15, color: colors.danger, fontWeight: '600' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  head: { backgroundColor: colors.surfaceAlt },
  overRow: { backgroundColor: '#FEF2F2' },
  rejectedRow: { backgroundColor: '#F8FAFC', opacity: 0.8 },
  info: { gap: 2 },
  backBox: { gap: spacing.sm, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: radius.lg, padding: spacing.md },
  backText: { fontSize: 14, color: '#92400E' },
  th: { fontSize: 13, fontWeight: '700', padding: 8, color: colors.text },
  td: { fontSize: 14, padding: 8, color: colors.text },
  tdText: { fontSize: 14, color: colors.text },
  reason: { fontSize: 12, color: colors.danger, marginTop: 2 },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },
  over: { color: colors.danger, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted },
  self: { alignSelf: 'flex-start' },
  gap: { gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cancelBox: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  danger: { backgroundColor: colors.danger },
});
