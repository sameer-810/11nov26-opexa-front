import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { api, ApiError } from '../../../shared/api/apiClient';
import { formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, spacing } from '../../../shared/designSystem';
import { receivingApi } from '../../receiving/api/receivingApi';
import { materialApi, type TransferTarget } from '../api/materialApi';
import { ItemSearch, LineList, type Line, type PickItem } from '../ItemLines';
import type { ReturnType } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewReturn'>;

export function NewReturnScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [items, setItems] = useState<PickItem[] | null>(null);
  const [type, setType] = useState<ReturnType>('store');
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [projects, setProjects] = useState<TransferTarget[]>([]);
  const [toProjectId, setToProjectId] = useState('');
  const [toItems, setToItems] = useState<PickItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    receivingApi.material(id)
      .then((m) => setItems(m.items.filter((r) => r.atSite > 0).map((r) => ({ id: r.workOrderItemId, serialNo: r.serialNo, description: r.description, unit: r.unit, available: r.atSite }))))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
    api<{ id: string; name: string }[]>('/vendors/names').then(setVendors).catch(() => undefined);
    materialApi.transferTargets().then((ps) => setProjects(ps.filter((p) => p.id !== id))).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    setToItems([]);
    setLines((ls) => ls.map((l) => ({ ...l, extra: undefined })));
    if (toProjectId) materialApi.transferTargetItems(toProjectId).then(setToItems).catch(() => undefined);
  }, [toProjectId]);

  const back = () => navigation.navigate('ProjectReturns', { id });
  if (!items) return <AppScreen title="Send material back" onBack={back}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;

  const save = async () => {
    setError('');
    const e: Record<string, string> = {};
    const le: Record<string, string> = {};
    if (type === 'vendor' && !vendorId) e.vendorId = 'Choose the vendor';
    if (type === 'transfer' && !toProjectId) e.toProjectId = 'Choose the project';
    if (reason.trim().length < 3) e.reason = 'Say why it is going back';
    if (!lines.length) e.items = 'Add at least one item';
    const body = lines.map((l) => {
      const q = parseNumber(l.qty);
      const i = items.find((x) => x.id === l.itemId)!;
      if (!q || q <= 0) le[l.itemId] = 'Enter the quantity';
      else if (q > (i.available ?? 0)) le[l.itemId] = `Only ${formatNumber(i.available ?? 0)} ${i.unit} at site`;
      if (type === 'transfer' && !l.extra) le[l.itemId] = 'Choose the matching item in the other project';
      return { workOrderItemId: l.itemId, qty: q ?? 0, ...(type === 'transfer' ? { toWorkOrderItemId: l.extra } : {}) };
    });
    setErrors(e);
    setLineErrors(le);
    if (Object.keys(e).length || Object.keys(le).length) return setError('Please fix the highlighted fields');
    setBusy(true);
    try {
      const r = await materialApi.createReturn(id, {
        type, reason: reason.trim(), challanNo: challanNo.trim() || undefined, lines: body,
        ...(type === 'vendor' ? { vendorId } : {}), ...(type === 'transfer' ? { toProjectId } : {}),
      });
      navigation.replace('ReturnDetail', { id: r.id });
    } catch (err) {
      if (err instanceof ApiError) {
        setLineErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        setError(err.message);
      } else setError('Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Send material back" subtitle="It leaves this site's stock now; the manager or buyer confirms when it reaches" onBack={back} testID="new-return-screen">
      <ChoiceChips label="Where is it going?" value={type} onChange={(v) => setType(v as ReturnType)} testID="rt-type"
        options={[{ value: 'store', label: 'Back to store' }, { value: 'vendor', label: 'Back to vendor' }, { value: 'transfer', label: 'Another project' }]} />
      {type === 'vendor' ? (
        vendors.length ? <ChoiceChips label="Vendor" value={vendorId} onChange={setVendorId} testID="rt-vendor" options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
          : <Text style={styles.muted}>No vendors yet. Ask the buyer to add one.</Text>
      ) : null}
      {errors.vendorId ? <Text style={styles.err}>{errors.vendorId}</Text> : null}
      {type === 'transfer' ? (
        projects.length ? <ChoiceChips label="To project" value={toProjectId} onChange={setToProjectId} testID="rt-project" options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} />
          : <Text style={styles.muted}>No other open project.</Text>
      ) : null}
      {errors.toProjectId ? <Text style={styles.err}>{errors.toProjectId}</Text> : null}

      <ItemSearch items={items} exclude={lines.map((l) => l.itemId)} onPick={(i) => setLines((ls) => [...ls, { itemId: i.id, qty: '' }])} testID="rt-search" error={errors.items} />
      <LineList lines={lines} items={items} errors={lineErrors} testID="rt"
        onQty={(itemId, v) => setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, qty: v } : l)))}
        onRemove={(itemId) => setLines((ls) => ls.filter((l) => l.itemId !== itemId))}
        renderExtra={type === 'transfer' && toProjectId ? (l) => {
          const chosen = toItems.find((t) => t.id === l.extra);
          const from = items.find((x) => x.id === l.itemId)!;
          return chosen ? (
            <Text style={styles.muted} testID={`rt-to-${from.serialNo}`}>Becomes S.No {chosen.serialNo}. {chosen.description} there · <Text style={styles.link} onPress={() => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, extra: undefined } : x)))}>change</Text></Text>
          ) : (
            <ItemSearch items={toItems} label="Same item in the other project" testID={`rt-to-search-${from.serialNo}`} onPick={(t) => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, extra: t.id } : x)))} />
          );
        } : undefined} />
      <TextField label="Reason" value={reason} onChangeText={setReason} error={errors.reason} placeholder="e.g. extra, wrong model, not needed here" testID="rt-reason" />
      <TextField label="Challan / gate pass no. (optional)" value={challanNo} onChangeText={setChallanNo} testID="rt-challan" />
      {error ? <ErrorBanner message={error} testID="rt-error" /> : null}
      <Button title="Send back" onPress={save} loading={busy} testID="rt-save" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  muted: { fontSize: 13, color: colors.textMuted },
  err: { fontSize: 13, color: colors.danger, marginTop: -spacing.xs },
  link: { color: colors.primary },
});
