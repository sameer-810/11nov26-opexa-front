import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatDateTime, formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import { receivingApi } from '../api/receivingApi';
import { submitOrQueue } from '../../../shared/offline/outbox';
import { invoiceApi, openPrint } from '../../invoice/invoiceApi';
import { canRecordAtSite } from '../canRecord';
import { LOT_LABEL, LOT_TONE, type Lot } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LotDetail'>;
type Row = { good: string; damaged: string; remark: string };

export function LotDetailScreen({ navigation, route }: Props) {
  const { projectId, lotId } = route.params;
  const { user } = useAuth();
  const [lot, setLot] = useState<Lot | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // The project is only needed to decide whether this person may check the lot in.
    Promise.all([receivingApi.lot(projectId, lotId), projectApi.get(projectId).catch(() => null)])
      .then(([l, p]) => {
        setLot(l);
        setCanRecord(canRecordAtSite(user, p?.memberIds ?? []));
        // Start with "everything arrived in good condition"; the person only changes what differs.
        setRows(Object.fromEntries(l.lines.map((x) => [x.id, { good: String(x.qty), damaged: '', remark: '' }])));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, [projectId, lotId, user]);

  const back = () => navigation.navigate('ProjectLots', { id: projectId });
  if (!lot) return <AppScreen title="Lot" onBack={back}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;

  const set = (id: string, k: keyof Row) => (v: string) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));

  const submit = async () => {
    setError('');
    setLineErrors({});
    const errs: Record<string, string> = {};
    const lines = lot.lines.map((x) => {
      const good = parseNumber(rows[x.id]?.good ?? '');
      const damaged = parseNumber(rows[x.id]?.damaged ?? '') ?? 0;
      if (good === null || good < 0) errs[x.id] = 'Enter the good quantity (0 if nothing came)';
      else if (good + damaged > x.qty) errs[x.id] = `Only ${formatNumber(x.qty)} ${x.unit} came in this lot`;
      return { lineId: x.id, qtyReceived: good ?? 0, qtyDamaged: damaged, remark: rows[x.id]?.remark.trim() || undefined };
    });
    if (Object.keys(errs).length) {
      setLineErrors(errs);
      return setError('Check the quantities');
    }
    setBusy(true);
    try {
      const r = await submitOrQueue<Lot>(`Check in Lot ${lot.lotNo}`, 'POST', `/projects/${projectId}/lots/${lotId}/receive`, { notes: notes.trim() || undefined, lines });
      if (r.queued) {
        setCanRecord(false);
        setMessage('No network. Saved on this phone - it will be sent automatically when you are back online.');
        setBusy(false);
        return;
      }
      const done = r.data;
      setLot(done);
      setMessage(done.status === 'received' ? 'Checked in. Everything arrived.' : 'Checked in. The buyer has been told what was short or damaged.');
    } catch (e) {
      if (e instanceof ApiError) {
        setLineErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
      } else setError('Something went wrong');
    }
    setBusy(false);
  };

  const open = lot.status === 'in-transit';
  return (
    <AppScreen title={`Lot ${lot.lotNo}`} subtitle={`${lot.vendorName} · ${lot.poNumber} · challan ${lot.challanNo}`} onBack={back} testID="lot-detail-screen">
      <View style={styles.row}>
        <StatusChip label={LOT_LABEL[lot.status]} tone={LOT_TONE[lot.status]} testID="lot-status" />
        <Text style={styles.muted}>Sent {formatDate(lot.dispatchDate)}{lot.vehicleNo ? ` · vehicle ${lot.vehicleNo}` : ''}</Text>
      </View>
      {message ? <Text style={styles.ok} testID="lot-message">{message}</Text> : null}
      {lot.receivedAt ? (
        <Text style={styles.muted} testID="lot-received-by">Checked in by {lot.receivedBy?.name ?? 'someone'} on {formatDateTime(lot.receivedAt)}{lot.receiptNotes ? ` · "${lot.receiptNotes}"` : ''}</Text>
      ) : null}

      <Button title="Print lot report" variant="outline" onPress={async () => { try { await openPrint((await invoiceApi.lotPrintLink(projectId, lotId)).url); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not open'); } }} testID="lot-print" style={styles.self} />
      {open && canRecord ? <Text style={styles.hint}>Count what arrived. Change the numbers only for items that came short or damaged.</Text> : null}
      {open && !canRecord ? <Text style={styles.muted}>Waiting for the site team to check this lot in.</Text> : null}

      {lot.lines.map((x) => (
        <View key={x.id} style={styles.item} testID={`lot-line-${x.serialNo}`}>
          <Text style={styles.itemTitle}>{x.serialNo}. {x.description}</Text>
          <Text style={styles.muted}>Sent: {formatNumber(x.qty)} {x.unit}</Text>
          {open && canRecord ? (
            <View style={styles.inputs}>
              <View style={styles.field}>
                <Text style={styles.small}>Good ({x.unit})</Text>
                <TextInput value={rows[x.id]?.good ?? ''} onChangeText={set(x.id, 'good')} keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`rcv-good-${x.serialNo}`} />
              </View>
              <View style={styles.field}>
                <Text style={styles.small}>Damaged</Text>
                <TextInput value={rows[x.id]?.damaged ?? ''} onChangeText={set(x.id, 'damaged')} keyboardType="decimal-pad" inputMode="decimal" style={styles.input} placeholder="0" testID={`rcv-damaged-${x.serialNo}`} />
              </View>
              <View style={[styles.field, styles.grow]}>
                <Text style={styles.small}>Remark</Text>
                <TextInput value={rows[x.id]?.remark ?? ''} onChangeText={set(x.id, 'remark')} style={styles.input} placeholder="e.g. box crushed" testID={`rcv-remark-${x.serialNo}`} />
              </View>
            </View>
          ) : null}
          {x.qtyReceived !== null ? (
            <Text style={x.qtyShort || x.qtyDamaged ? styles.bad : styles.good} testID={`lot-result-${x.serialNo}`}>
              Good {formatNumber(x.qtyReceived)}{x.qtyDamaged ? ` · damaged ${formatNumber(x.qtyDamaged)}` : ''}{x.qtyShort ? ` · short ${formatNumber(x.qtyShort)}` : ''}{x.remark ? ` · ${x.remark}` : ''}
            </Text>
          ) : null}
          {lineErrors[x.id] ? <Text style={styles.err}>{lineErrors[x.id]}</Text> : null}
        </View>
      ))}

      {open && canRecord ? (
        <>
          <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} testID="rcv-notes" />
          {error ? <ErrorBanner message={error} testID="rcv-error" /> : null}
          <Button title="Check in this lot" onPress={submit} loading={busy} testID="rcv-submit" style={styles.self} />
        </>
      ) : error ? <ErrorBanner message={error} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  muted: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 14, color: colors.text },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  inputs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  field: { gap: 4, minWidth: 90 },
  grow: { flex: 1, minWidth: 160 },
  small: { fontSize: 12, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: colors.text },
  good: { fontSize: 14, color: colors.success, fontWeight: '600' },
  bad: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  err: { fontSize: 13, color: colors.danger },
  self: { alignSelf: 'flex-start' },
});
