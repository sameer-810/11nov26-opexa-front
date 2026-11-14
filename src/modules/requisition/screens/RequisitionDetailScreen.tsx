import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDateTime, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../api/requisitionApi';
import { PURCHASE_LABEL, type Requisition } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequisitionDetail'>;

export function RequisitionDetailScreen({ navigation, route }: Props) {
  const { id, justCreated } = route.params;
  const { user } = useAuth();
  const [req, setReq] = useState<Requisition | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setReq(await requisitionApi.get(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const back = () => (req ? navigation.navigate('Requisitions', { projectId: req.projectId }) : navigation.navigate('Dashboard'));
  if (loadError) return <AppScreen title="Material request" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!req) return <AppScreen title="Material request" onBack={() => navigation.navigate('Dashboard')}><ActivityIndicator /></AppScreen>;

  const canCancel = req.status === 'open' && (req.raisedBy.id === user?.id || can(user, PERMS.PROJECT_MANAGE));

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
            label={req.purchaseStatus ? PURCHASE_LABEL[req.purchaseStatus] : req.status === 'open' ? 'Open' : 'Cancelled'}
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
      {req.note ? <Text style={styles.note}>Note: {req.note}</Text> : null}
      {req.status === 'cancelled' ? <Text style={styles.cancelled}>Cancelled: {req.cancelReason}</Text> : null}

      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.tr, styles.head]}>
            {['S.No', 'Item', 'Unit', 'BOQ', 'Earlier', 'This request', 'Over BOQ', 'Ordered', 'Dispatched', 'Received'].map((h, i) => (
              <Text key={h} style={[styles.th, { width: W[i] }, i > 2 && styles.right]}>{h}</Text>
            ))}
          </View>
          {req.lines.map((l) => (
            <View key={l.id} style={[styles.tr, l.overBy > 0 && styles.overRow]} testID={`req-line-${l.serialNo}`}>
              <Text style={[styles.td, { width: W[0] }]}>{l.serialNo}</Text>
              <View style={{ width: W[1], padding: 8 }}>
                <Text style={styles.tdText}>{l.description}</Text>
                {l.overrideReason ? <Text style={styles.reason}>Reason: {l.overrideReason}</Text> : null}
              </View>
              <Text style={[styles.td, { width: W[2] }]}>{l.unit}</Text>
              <Text style={[styles.td, styles.right, { width: W[3] }]}>{formatNumber(l.boqQty)}</Text>
              <Text style={[styles.td, styles.right, { width: W[4] }]}>{formatNumber(l.previouslyRequested)}</Text>
              <Text style={[styles.td, styles.right, styles.bold, { width: W[5] }]}>{formatNumber(l.qtyRequested)}</Text>
              <Text style={[styles.td, styles.right, { width: W[6] }, l.overBy > 0 && styles.over]}>{l.overBy > 0 ? `+${formatNumber(l.overBy)}` : '—'}</Text>
              <Text style={[styles.td, styles.right, { width: W[7] }]}>{formatNumber(l.ordered ?? 0)}</Text>
              <Text style={[styles.td, styles.right, { width: W[8] }]}>{formatNumber(l.dispatched ?? 0)}</Text>
              <Text style={[styles.td, styles.right, { width: W[9] }]}>{formatNumber(l.received ?? 0)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {can(user, PERMS.PURCHASE_MANAGE) && req.status === 'open' && req.lines.some((l) => (l.toOrder ?? 0) > 0) ? (
        <Button title="Create purchase order" onPress={() => navigation.navigate('NewPurchaseOrder', { requisitionId: req.id })} testID="create-po" style={styles.self} />
      ) : null}

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
    </AppScreen>
  );
}

const W = [50, 240, 60, 70, 70, 100, 80, 80, 90, 90];

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
  th: { fontSize: 13, fontWeight: '700', padding: 8, color: colors.text },
  td: { fontSize: 14, padding: 8, color: colors.text },
  tdText: { fontSize: 14, color: colors.text },
  reason: { fontSize: 12, color: colors.danger, marginTop: 2 },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },
  over: { color: colors.danger, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted },
  self: { alignSelf: 'flex-start' },
  cancelBox: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  danger: { backgroundColor: colors.danger },
});
