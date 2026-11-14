import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatMoney, formatNumber, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { purchaseOrderApi } from '../api/purchaseOrderApi';
import { DELIVERY_LABEL, type PurchaseOrder } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseOrderDetail'>;
const today = () => todayLocal();

export function PurchaseOrderDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<'' | 'dispatch' | 'cancel'>('');
  const [challan, setChallan] = useState('');
  const [date, setDate] = useState(today());
  const [vehicle, setVehicle] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPo(await purchaseOrderApi.get(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <AppScreen title="Purchase order" onBack={() => navigation.navigate('PurchaseOrders')}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!po) return <AppScreen title="Purchase order" onBack={() => navigation.navigate('PurchaseOrders')}><ActivityIndicator /></AppScreen>;

  const pendingLines = po.lines.filter((l) => l.pending > 0);
  const startDispatch = () => {
    setMode('dispatch');
    setError('');
    setMessage('');
    setQtys(Object.fromEntries(pendingLines.map((l) => [l.id, String(l.pending)])));
  };

  const saveDispatch = async () => {
    setError('');
    setLineErrors({});
    if (!challan.trim()) return setError('Enter the delivery challan number');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter the date as YYYY-MM-DD');
    const lines = pendingLines.map((l) => ({ poLineId: l.id, qty: parseNumber(qtys[l.id] ?? '') ?? 0 })).filter((x) => x.qty > 0);
    if (!lines.length) return setError('Enter the quantity sent for at least one item');
    setBusy(true);
    try {
      const res = await purchaseOrderApi.dispatch(id, { challanNo: challan.trim(), dispatchDate: date, vehicleNo: vehicle.trim() || undefined, lines });
      setPo(res.purchaseOrder);
      setMode('');
      setChallan('');
      setVehicle('');
      setMessage(`Lot ${res.lotNo} recorded. The site team has been notified.`);
    } catch (e) {
      if (e instanceof ApiError) {
        setLineErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
      } else setError('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (reason.trim().length < 3) return setError('Give a reason');
    setBusy(true);
    try {
      setPo(await purchaseOrderApi.cancel(id, reason.trim()));
      setMode('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const tone = po.deliveryStatus === 'dispatched' ? 'success' : po.deliveryStatus === 'cancelled' ? 'neutral' : po.deliveryStatus === 'partly-dispatched' ? 'warning' : 'info';

  return (
    <AppScreen
      title={`${po.number} · ${po.vendor?.name ?? ''}`}
      subtitle={`${po.projectCode} ${po.projectName} · ${formatDate(po.createdAt)} · ${formatMoney(po.total)}`}
      onBack={() => navigation.navigate('PurchaseOrders')}
      right={<StatusChip label={DELIVERY_LABEL[po.deliveryStatus]} tone={tone} testID="po-status" />}
      testID="po-detail-screen"
    >
      {message ? <View style={styles.ok} testID="po-message"><Text style={styles.okText}>{message}</Text></View> : null}
      {po.status === 'cancelled' ? <Text style={styles.cancelled}>Cancelled: {po.cancelReason}</Text> : null}
      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={[styles.tr, styles.head]}>
            {['S.No', 'Item', 'Unit', 'Ordered', 'Rate', 'Dispatched', 'Pending'].map((h, i) => (
              <Text key={h} style={[styles.th, { width: W[i] }, i > 2 && styles.right]}>{h}</Text>
            ))}
          </View>
          {po.lines.map((l) => (
            <View key={l.id} style={styles.tr} testID={`po-line-${l.serialNo}`}>
              <Text style={[styles.td, { width: W[0] }]}>{l.serialNo}</Text>
              <Text style={[styles.td, { width: W[1] }]}>{l.description}</Text>
              <Text style={[styles.td, { width: W[2] }]}>{l.unit}</Text>
              <Text style={[styles.td, styles.right, { width: W[3] }]}>{formatNumber(l.qty)}</Text>
              <Text style={[styles.td, styles.right, { width: W[4] }]}>{formatMoney(l.rate)}</Text>
              <Text style={[styles.td, styles.right, { width: W[5] }]}>{formatNumber(l.dispatched)}</Text>
              <Text style={[styles.td, styles.right, { width: W[6] }, l.pending > 0 && styles.pending]}>{formatNumber(l.pending)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.section}>Deliveries</Text>
      {po.lots.length === 0 ? <Text style={styles.muted}>Nothing dispatched yet.</Text> : null}
      {po.lots.map((lot) => (
        <View key={lot.id} style={styles.lot} testID={`lot-${lot.lotNo}`}>
          <Text style={styles.lotTitle}>Lot {lot.lotNo} · Challan {lot.challanNo} · {formatDate(lot.dispatchDate)}{lot.vehicleNo ? ` · ${lot.vehicleNo}` : ''}</Text>
          <Text style={styles.muted}>{lot.lines.map((x) => `${x.serialNo} × ${formatNumber(x.qty)} ${x.unit}`).join(', ')}</Text>
        </View>
      ))}

      {error && mode === '' ? <ErrorBanner message={error} /> : null}
      {po.status === 'issued' && mode === '' ? (
        <View style={styles.row}>
          {pendingLines.length ? <Button title="Record dispatch (new lot)" onPress={startDispatch} testID="record-dispatch" /> : null}
          {po.lots.length === 0 ? <Button title="Cancel PO" variant="ghost" onPress={() => { setMode('cancel'); setError(''); }} testID="cancel-po" /> : null}
        </View>
      ) : null}

      {mode === 'dispatch' ? (
        <View style={styles.box} testID="dispatch-form">
          <Text style={styles.boxTitle}>Record what the vendor sent</Text>
          <Text style={styles.muted}>Enter what is on the vendor's delivery challan. The site will confirm what actually arrives.</Text>
          <View style={styles.row}>
            <View style={styles.cell}><TextField label="Challan number" value={challan} onChangeText={setChallan} testID="d-challan" /></View>
            <View style={styles.cell}><TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="d-date" /></View>
            <View style={styles.cell}><TextField label="Vehicle no. (optional)" value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" /></View>
          </View>
          {pendingLines.map((l) => (
            <View key={l.id} style={styles.dline}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{l.serialNo}. {l.description}</Text>
                <Text style={styles.muted}>Pending {formatNumber(l.pending)} {l.unit}</Text>
                {lineErrors[l.id] ? <Text style={styles.err}>{lineErrors[l.id]}</Text> : null}
              </View>
              <TextInput value={qtys[l.id] ?? ''} onChangeText={(v) => setQtys((q) => ({ ...q, [l.id]: v }))} keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`d-qty-${l.serialNo}`} />
            </View>
          ))}
          {error ? <ErrorBanner message={error} testID="dispatch-error" /> : null}
          <View style={styles.row}>
            <Button title="Save lot" onPress={saveDispatch} loading={busy} testID="d-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setMode('')} />
          </View>
        </View>
      ) : null}

      {mode === 'cancel' ? (
        <View style={styles.box}>
          <TextField label="Why cancel this PO?" value={reason} onChangeText={setReason} testID="po-cancel-reason" />
          {error ? <ErrorBanner message={error} /> : null}
          <View style={styles.row}>
            <Button title="Yes, cancel PO" onPress={doCancel} loading={busy} style={styles.danger} testID="po-cancel-confirm" />
            <Button title="Keep it" variant="ghost" onPress={() => setMode('')} />
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const W = [50, 240, 60, 80, 100, 90, 80];

const styles = StyleSheet.create({
  ok: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  okText: { color: '#065F46', fontWeight: '700' },
  cancelled: { fontSize: 15, color: colors.danger, fontWeight: '600' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  th: { fontSize: 13, fontWeight: '700', padding: 8, color: colors.text },
  td: { fontSize: 14, padding: 8, color: colors.text },
  right: { textAlign: 'right' },
  pending: { color: colors.danger, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, color: colors.textMuted },
  lot: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  lotTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  box: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, backgroundColor: '#F8FAFF' },
  boxTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cell: { flexGrow: 1, flexBasis: 180 },
  dline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: { width: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: 15, textAlign: 'right', color: colors.text, backgroundColor: colors.surface },
  err: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  danger: { backgroundColor: colors.danger },
});
