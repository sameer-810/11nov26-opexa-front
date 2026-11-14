import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../api/requisitionApi';
import type { BalanceRow, OverBoqLine, Requisition } from '../types';
import { submitOrQueue } from '../../../shared/offline/outbox';

type Props = NativeStackScreenProps<RootStackParamList, 'NewRequisition'>;

export function NewRequisitionScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState<OverBoqLine[] | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requisitionApi
      .balance(projectId)
      .then(setRows)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Could not load the BOQ'));
  }, [projectId]);

  const chosen = useMemo(
    () => Object.entries(qtys).map(([id, v]) => ({ id, qty: parseNumber(v) })).filter((x) => x.qty !== null && x.qty > 0) as { id: string; qty: number }[],
    [qtys],
  );
  const badQty = Object.values(qtys).some((v) => v.trim() !== '' && (parseNumber(v) === null || (parseNumber(v) ?? 0) <= 0));
  const visible = (rows ?? []).filter((r) => !search.trim() || `${r.serialNo} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase()));

  const send = async (withReason?: string) => {
    setError('');
    if (badQty) return setError('Quantities must be numbers above 0. Clear any box you do not need.');
    if (!chosen.length) return setError('Enter a quantity for at least one item.');
    setBusy(true);
    try {
      const r = await submitOrQueue<Requisition>(`Material request (${chosen.length} item${chosen.length === 1 ? '' : 's'})`, 'POST', `/projects/${projectId}/requisitions`, {
        lines: chosen.map((c) => ({ workOrderItemId: c.id, qty: c.qty, ...(withReason ? { reason: withReason } : {}) })),
        note: note.trim() || undefined,
      });
      if (r.queued) {
        setQueued(true);
        setBusy(false);
        return;
      }
      navigation.replace('RequisitionDetail', { id: r.data.id, justCreated: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OVER_BOQ') {
        setOver(e.details as unknown as OverBoqLine[]);
      } else setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const confirmOver = () => {
    if (reason.trim().length < 3) return setReasonError('Say why the extra quantity is needed (e.g. client approved on call)');
    setReasonError('');
    send(reason.trim());
  };

  const back = () => navigation.navigate('ProjectDetail', { id: projectId });
  if (loadError) return <AppScreen title="New material request" onBack={back}><ErrorState message={loadError} /></AppScreen>;
  if (!rows) return <AppScreen title="New material request" onBack={back}><ActivityIndicator /></AppScreen>;

  if (queued) {
    return (
      <AppScreen title="New material request" onBack={back} testID="new-requisition-screen">
        <Text style={styles.queued} testID="req-queued">No network. Your request is saved on this phone and will be sent automatically when you are back online. You will see it in the request list after that.</Text>
        <Button title="Back to project" onPress={back} testID="req-queued-back" />
      </AppScreen>
    );
  }

  return (
    <AppScreen title="New material request" subtitle="Enter the quantity you need now for each item" onBack={back} testID="new-requisition-screen">
      {rows.length === 0 ? <EmptyState title="No BOQ items" body="The office needs to load this project's work order first." /> : null}

      {over ? (
        <View style={styles.warn} testID="over-boq-warning">
          <Text style={styles.warnTitle}>This goes beyond the work order (BOQ)</Text>
          {over.map((o) => (
            <Text key={o.field} style={styles.warnLine}>
              S.No {o.serialNo}: BOQ {formatNumber(o.boqQty)}, already requested {formatNumber(o.previouslyRequested)}, now {formatNumber(o.qtyRequested)} →{' '}
              <Text style={styles.extra}>{formatNumber(o.overBy)} extra</Text>
            </Text>
          ))}
          <Text style={styles.warnBody}>Do you really need the extra quantity? The owner will be told, and it goes on the PO amendment list.</Text>
          <TextField label="Reason" testID="over-reason" value={reason} onChangeText={(v) => { setReason(v); setReasonError(''); }} error={reasonError} placeholder="e.g. Client approved 2 extra on call, PO amendment coming" />
          <View style={styles.row}>
            <Button title="Yes, request anyway" onPress={confirmOver} loading={busy} testID="over-confirm" />
            <Button title="No, change quantities" variant="ghost" onPress={() => { setOver(null); setReason(''); }} testID="over-cancel" />
          </View>
        </View>
      ) : null}

      {rows.length > 5 ? <TextField label="Search items" value={search} onChangeText={setSearch} placeholder="S.No or description" testID="req-search" /> : null}
      <View style={styles.list}>
        {visible.map((r) => {
          const val = qtys[r.workOrderItemId] ?? '';
          const n = parseNumber(val) ?? 0;
          const willExceed = n > 0 && n > r.balance;
          return (
            <View key={r.workOrderItemId} style={[styles.item, n > 0 && styles.itemOn]} testID={`req-item-${r.serialNo}`}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{r.serialNo}. {r.description}</Text>
                <Text style={styles.muted}>
                  BOQ {formatNumber(r.boqQty)} {r.unit} · requested {formatNumber(r.requested)} ·{' '}
                  <Text style={r.balance <= 0 ? styles.extra : styles.balance}>balance {formatNumber(r.balance)}</Text>
                </Text>
                {willExceed ? <Text style={styles.extra}>More than the balance: {formatNumber(n - Math.max(r.balance, 0))} extra</Text> : null}
              </View>
              <View style={styles.qtyBox}>
                <TextInput
                  value={val}
                  onChangeText={(v) => { setQtys((q) => ({ ...q, [r.workOrderItemId]: v })); setOver(null); }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0"
                  style={[styles.qtyInput, willExceed && styles.qtyWarn]}
                  accessibilityLabel={`Quantity for ${r.description}`}
                  testID={`req-qty-${r.serialNo}`}
                />
                <Text style={styles.unit}>{r.unit}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <TextField label="Note for the purchaser (optional)" value={note} onChangeText={setNote} testID="req-note" placeholder="e.g. Needed by Friday for floors 1-5" multiline />
      {error ? <ErrorBanner message={error} testID="req-error" /> : null}
      {!over ? (
        <Button title={`Send request (${chosen.length} item${chosen.length === 1 ? '' : 's'})`} onPress={() => send()} loading={busy} testID="req-submit" style={styles.self} />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  queued: { fontSize: 15, color: colors.text, lineHeight: 22 },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  itemOn: { borderColor: colors.primary, backgroundColor: '#F8FAFF' },
  flex: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  balance: { color: colors.success, fontWeight: '700' },
  extra: { color: colors.danger, fontWeight: '700' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyInput: { width: 90, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10, fontSize: 16, textAlign: 'right', color: colors.text },
  qtyWarn: { borderColor: colors.danger },
  unit: { width: 44, fontSize: 13, color: colors.textMuted },
  warn: { borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  warnTitle: { fontSize: 17, fontWeight: '800', color: colors.danger },
  warnLine: { fontSize: 14, color: colors.text },
  warnBody: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  self: { alignSelf: 'flex-start' },
});
