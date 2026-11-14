import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatMoney, formatNumber, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import type { BoqItem, Project } from '../../project/types';
import { receivingApi } from '../api/receivingApi';
import { submitOrQueue } from '../../../shared/offline/outbox';
import { canRecordAtSite } from '../canRecord';
import type { LocalPurchase } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalPurchases'>;
const today = () => todayLocal();
const empty = { qty: '', rate: '', vendorName: '', billNo: '', purchaseDate: today(), reason: '' };
type Form = typeof empty;

export function LocalPurchasesScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [rows, setRows] = useState<LocalPurchase[] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'item', string>>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [lp, p, boq] = await Promise.all([receivingApi.localPurchases(id), projectApi.get(id), projectApi.boq(id)]);
      setRows(lp);
      setProject(p);
      setItems(boq);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const mayAdd = !!project && project.status !== 'closed' && (can(user, PERMS.PURCHASE_MANAGE) || canRecordAtSite(user, project.memberIds));
  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const q = search.trim().toLowerCase();
  const matches = q ? items.filter((i) => i.serialNo.toLowerCase() === q || i.description.toLowerCase().includes(q)).slice(0, 8) : [];
  const item = items.find((i) => i.id === itemId);

  const save = async () => {
    setError('');
    const e: typeof errors = {};
    const qty = parseNumber(form.qty);
    const rate = parseNumber(form.rate);
    if (!item) e.item = 'Choose the BOQ item';
    if (!qty || qty <= 0) e.qty = 'Enter the quantity';
    if (rate === null || rate < 0) e.rate = 'Enter the rate';
    if (form.vendorName.trim().length < 2) e.vendorName = 'Enter the shop / vendor name';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.purchaseDate)) e.purchaseDate = 'Use YYYY-MM-DD';
    if (form.reason.trim().length < 3) e.reason = 'Say why it was bought locally';
    if (Object.keys(e).length) return setErrors(e);
    setBusy(true);
    try {
      const r = await submitOrQueue<LocalPurchase>(`Local purchase: ${item!.serialNo}. ${item!.description}`, 'POST', `/projects/${id}/local-purchases`, {
        workOrderItemId: item!.id, qty: qty!, rate: rate!, vendorName: form.vendorName.trim(), billNo: form.billNo.trim() || undefined, purchaseDate: form.purchaseDate, reason: form.reason.trim(),
      });
      if (r.queued) {
        setMessage('No network. Saved on this phone - it will be sent when you are back online.');
        setAdding(false);
        setForm(empty);
        setItemId('');
        setSearch('');
        setBusy(false);
        return;
      }
      const lp = r.data;
      setMessage(`${lp.number} saved${lp.overBy ? `. Note: this goes ${formatNumber(lp.overBy)} ${lp.unit} over the BOQ` : ''}. Your manager has been told.`);
      setAdding(false);
      setForm(empty);
      setItemId('');
      setSearch('');
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field === 'workOrderItemId' ? 'item' : d.field, d.message])));
        setError(err.message);
      } else setError('Something went wrong');
    }
    setBusy(false);
  };

  return (
    <AppScreen title="Local purchase" subtitle="Small or urgent items the site bought itself, outside a PO" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="local-purchases-screen">
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!rows && !loadError ? <ActivityIndicator /> : null}
      {message ? <Text style={styles.ok} testID="lp-message">{message}</Text> : null}
      {mayAdd && !adding ? <Button title="Add local purchase" onPress={() => { setAdding(true); setMessage(''); }} testID="lp-add" style={styles.self} /> : null}

      {adding ? (
        <View style={styles.box} testID="lp-form">
          {item ? (
            <View style={styles.chosen}>
              <Text style={styles.itemTitle} testID="lp-item">{item.serialNo}. {item.description} ({item.unit})</Text>
              <Button title="Change" variant="ghost" onPress={() => setItemId('')} testID="lp-change-item" />
            </View>
          ) : (
            <>
              <TextField label="BOQ item (search by S.No or name)" value={search} onChangeText={setSearch} error={errors.item} testID="lp-search" />
              {matches.map((i) => (
                <Pressable key={i.id} onPress={() => { setItemId(i.id); setErrors((x) => ({ ...x, item: undefined })); }} style={styles.match} testID={`lp-pick-${i.serialNo}`}>
                  <Text>{i.serialNo}. {i.description} · BOQ {formatNumber(i.quantity)} {i.unit}</Text>
                </Pressable>
              ))}
            </>
          )}
          <View style={styles.two}>
            <View style={styles.half}><TextField label={`Quantity${item ? ` (${item.unit})` : ''}`} value={form.qty} onChangeText={set('qty')} keyboardType="decimal-pad" inputMode="decimal" error={errors.qty} testID="lp-qty" /></View>
            <View style={styles.half}><TextField label="Rate ₹" value={form.rate} onChangeText={set('rate')} keyboardType="decimal-pad" inputMode="decimal" error={errors.rate} testID="lp-rate" /></View>
          </View>
          <TextField label="Shop / vendor" value={form.vendorName} onChangeText={set('vendorName')} error={errors.vendorName} testID="lp-vendor" />
          <View style={styles.two}>
            <View style={styles.half}><TextField label="Bill no. (optional)" value={form.billNo} onChangeText={set('billNo')} testID="lp-bill" /></View>
            <View style={styles.half}><TextField label="Date (YYYY-MM-DD)" value={form.purchaseDate} onChangeText={set('purchaseDate')} error={errors.purchaseDate} testID="lp-date" /></View>
          </View>
          <TextField label="Why was it bought locally?" value={form.reason} onChangeText={set('reason')} error={errors.reason} placeholder="e.g. urgent, vendor delivery late" testID="lp-reason" />
          {error ? <ErrorBanner message={error} testID="lp-error" /> : null}
          <View style={styles.actions}>
            <Button title="Save" onPress={save} loading={busy} testID="lp-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} testID="lp-cancel" />
          </View>
        </View>
      ) : null}

      {rows && rows.length === 0 && !adding ? <EmptyState title="No local purchases yet" /> : null}
      <View style={styles.list}>
        {rows?.map((r) => (
          <View key={r.id} style={styles.card} testID={`lp-${r.number}`}>
            <View style={styles.chosen}>
              <Text style={styles.itemTitle}>{r.number} · {r.serialNo}. {r.description}</Text>
              {r.overBy ? <StatusChip label={`Over BOQ by ${formatNumber(r.overBy)}`} tone="danger" /> : null}
            </View>
            <Text style={styles.line}>{formatNumber(r.qty)} {r.unit} × {formatMoney(r.rate)} = {formatMoney(r.amount)} from {r.vendorName}{r.billNo ? ` (bill ${r.billNo})` : ''}</Text>
            <Text style={styles.muted}>{formatDate(r.purchaseDate)} · by {r.createdBy?.name ?? '—'} · {r.reason}</Text>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  chosen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  match: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  two: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 140 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  line: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
