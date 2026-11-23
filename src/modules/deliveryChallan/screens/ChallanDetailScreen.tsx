import { useCallback, useEffect, useState } from 'react';
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
import { openPrint } from '../../invoice/invoiceApi';
import { AttachmentList } from '../../requisition/components/Attachments';
import { challanApi } from '../api/challanApi';
import type { DeliveryChallan } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChallanDetail'>;

const HEAD = ['S.No', 'Material', 'Unit', 'Requested', 'This challan', 'Delivered to date', 'Pending'];
const W = [80, 240, 60, 90, 100, 120, 80];

export function ChallanDetailScreen({ navigation, route }: Props) {
  const { id, justCreated, attachFailed } = route.params;
  const { user } = useAuth();
  const [dc, setDc] = useState<DeliveryChallan | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setDc(await challanApi.get(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const back = () => (dc ? navigation.navigate('RequisitionDetail', { id: dc.requisitionId }) : navigation.navigate('Challans'));
  if (loadError) return <AppScreen title="Delivery challan" onBack={() => navigation.navigate('Challans')}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!dc) return <AppScreen title="Delivery challan" onBack={() => navigation.navigate('Challans')}><ActivityIndicator /></AppScreen>;

  const canCancel = dc.status === 'active' && (can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.STORE_MANAGE));
  const act = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
    setBusy('');
  };
  const doCancel = () => {
    if (reason.trim().length < 3) return setError('Give a reason for cancelling');
    return act('cancel', async () => {
      setDc(await challanApi.cancel(dc.id, reason.trim()));
      setCancelling(false);
    });
  };

  return (
    <AppScreen
      title={`Delivery challan ${dc.number}`}
      subtitle={`${dc.projectCode ?? ''} ${dc.projectName ?? ''} · ${dc.requisitionNumber ?? ''} · ${formatDate(dc.date)}`}
      onBack={back}
      right={<StatusChip label={dc.status === 'active' ? 'Received' : 'Cancelled'} tone={dc.status === 'active' ? 'success' : 'neutral'} testID="dc-status" />}
      testID="challan-detail-screen"
    >
      {justCreated ? <Text style={styles.ok} testID="dc-created">Challan {dc.number} created. Stock at site is updated.</Text> : null}
      {attachFailed ? <ErrorBanner message="The challan was saved, but some attachments could not be uploaded." testID="dc-attach-failed" /> : null}
      {dc.status === 'cancelled' ? <Text style={styles.cancelled} testID="dc-cancelled">Cancelled by {dc.cancelledBy?.name ?? '—'} on {formatDateTime(dc.cancelledAt)}: {dc.cancelReason}</Text> : null}
      <View style={styles.info} testID="dc-info">
        <Text style={styles.text}>Deliver to: {dc.deliveryAddress || '—'}</Text>
        <Text style={styles.text}>Supplier: {dc.supplierName || '—'}{dc.vendorChallanNo ? ` · supplier challan ${dc.vendorChallanNo}` : ''}{dc.vehicleNo ? ` · vehicle ${dc.vehicleNo}` : ''}</Text>
        <Text style={styles.text}>Prepared by {dc.preparedBy?.name ?? '—'} · received by {dc.receivedByName || '—'}</Text>
        {dc.remarks ? <Text style={styles.text}>Remarks: {dc.remarks}</Text> : null}
      </View>
      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.tr, styles.head]}>
            {HEAD.map((h, i) => <Text key={h} style={[styles.th, { width: W[i] }, i > 2 && styles.right]}>{h}</Text>)}
          </View>
          {dc.lines.map((l) => (
            <View key={l.id} style={styles.tr} testID={`dc-line-${l.serialNo}`}>
              <Text style={[styles.td, { width: W[0] }]}>{l.serialNo}</Text>
              <Text style={[styles.td, { width: W[1] }]}>{l.description}{l.specification ? `\n${l.specification}` : ''}</Text>
              <Text style={[styles.td, { width: W[2] }]}>{l.unit}</Text>
              <Text style={[styles.td, styles.right, { width: W[3] }]}>{formatNumber(l.qtyApproved)}</Text>
              <Text style={[styles.td, styles.right, styles.bold, { width: W[4] }]}>{formatNumber(l.qty)}</Text>
              <Text style={[styles.td, styles.right, { width: W[5] }]}>{formatNumber(l.cumulative)}</Text>
              <Text style={[styles.td, styles.right, { width: W[6] }]}>{formatNumber(l.pending)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.row}>
        <Button title="Print / PDF" onPress={() => act('print', async () => openPrint((await challanApi.printLink(dc.id)).url))} loading={busy === 'print'} testID="dc-print" />
        <Button title="Open material request" variant="outline" onPress={() => navigation.navigate('RequisitionDetail', { id: dc.requisitionId })} testID="dc-open-mr" />
        {canCancel && !cancelling ? <Button title="Cancel challan" variant="ghost" onPress={() => setCancelling(true)} testID="dc-cancel" /> : null}
      </View>
      {cancelling ? (
        <View style={styles.box}>
          <Text style={styles.text}>Cancelling reverses the stock this challan added and makes the quantity pending again. The challan stays on record.</Text>
          <TextField label="Why cancel?" value={reason} onChangeText={setReason} testID="dc-cancel-reason" />
          <View style={styles.row}>
            <Button title="Yes, cancel challan" onPress={doCancel} loading={busy === 'cancel'} style={styles.danger} testID="dc-cancel-confirm" />
            <Button title="Keep it" variant="ghost" onPress={() => setCancelling(false)} />
          </View>
        </View>
      ) : null}
      {error ? <ErrorBanner message={error} testID="dc-error" /> : null}
      <AttachmentList items={dc.attachments} onError={setError} fetchFile={(a) => challanApi.downloadAttachment(dc.id, a)} />
      <View style={styles.box} testID="dc-history">
        <Text style={styles.title}>History</Text>
        {dc.history.map((h, i) => (
          <Text key={`${h.action}-${i}`} style={styles.muted}>{h.action === 'created' ? 'Created' : 'Cancelled'} by {h.by?.name ?? '—'} · {formatDateTime(h.at)}{h.comment ? ` · ${h.comment}` : ''}</Text>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  ok: { color: '#065F46', fontWeight: '700', backgroundColor: '#ECFDF5', borderRadius: radius.md, padding: spacing.md },
  cancelled: { fontSize: 15, color: colors.danger, fontWeight: '600' },
  info: { gap: 2 },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  head: { backgroundColor: colors.surfaceAlt },
  th: { fontSize: 13, fontWeight: '700', padding: 8, color: colors.text },
  td: { fontSize: 14, padding: 8, color: colors.text },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },
  box: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  danger: { backgroundColor: colors.danger },
});
