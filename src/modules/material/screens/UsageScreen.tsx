import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate, formatNumber, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import { receivingApi } from '../../receiving/api/receivingApi';
import { canRecordAtSite } from '../../receiving/canRecord';
import { materialApi } from '../api/materialApi';
import { submitOrQueue } from '../../../shared/offline/outbox';
import { ItemSearch, LineList, type Line, type PickItem } from '../ItemLines';
import type { Usage } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Usage'>;
const today = () => todayLocal();

// Daily log of what was fixed/installed at site.
export function UsageScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [rows, setRows] = useState<Usage[] | null>(null);
  const [items, setItems] = useState<PickItem[]>([]);
  const [mayAdd, setMayAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [date, setDate] = useState(today());
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [u, m, p] = await Promise.all([materialApi.usage(id), receivingApi.material(id), projectApi.get(id)]);
      setRows(u);
      setItems(m.items.filter((r) => r.atSite > 0).map((r) => ({ id: r.workOrderItemId, serialNo: r.serialNo, description: r.description, unit: r.unit, available: r.atSite })));
      setMayAdd(p.status !== 'closed' && canRecordAtSite(user, p.memberIds));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id, user]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const save = async () => {
    setError('');
    const errs: Record<string, string> = {};
    const body = lines.map((l) => {
      const q = parseNumber(l.qty);
      const i = items.find((x) => x.id === l.itemId)!;
      if (!q || q <= 0) errs[l.itemId] = 'Enter the quantity';
      else if (i.available !== undefined && q > i.available) errs[l.itemId] = `Only ${formatNumber(i.available)} ${i.unit} at site`;
      return { workOrderItemId: l.itemId, qty: q ?? 0 };
    });
    setLineErrors(errs);
    if (!lines.length) return setError('Add at least one item');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date must be YYYY-MM-DD');
    if (Object.keys(errs).length) return setError('Check the quantities');
    setBusy(true);
    try {
      const r = await submitOrQueue('Installation ' + date + (area.trim() ? ` (${area.trim()})` : ''), 'POST', `/projects/${id}/usage`, { date, area: area.trim() || undefined, note: note.trim() || undefined, lines: body });
      setMessage(r.queued ? 'No network. Saved on this phone - it will be sent when you are back online.' : 'Installation saved.');
      setAdding(false);
      setLines([]);
      setArea('');
      setNote('');
      load();
    } catch (e) {
      if (e instanceof ApiError) {
        setLineErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
      } else setError('Something went wrong');
    }
    setBusy(false);
  };

  return (
    <AppScreen title="Installation log" subtitle="What was fixed at site each day. Installed material leaves the site stock." onBack={() => navigation.navigate('ProjectDetail', { id })} testID="usage-screen">
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!rows && !loadError ? <ActivityIndicator /> : null}
      {message ? <Text style={styles.ok} testID="usage-message">{message}</Text> : null}
      {mayAdd && !adding ? <Button title="Add today's installation" onPress={() => { setAdding(true); setMessage(''); }} testID="usage-add" style={styles.self} /> : null}
      {adding ? (
        <View style={styles.box}>
          <View style={styles.two}>
            <View style={styles.half}><TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="usage-date" /></View>
            <View style={styles.half}><TextField label="Area / floor (optional)" value={area} onChangeText={setArea} placeholder="e.g. Floor 3, east wing" testID="usage-area" /></View>
          </View>
          <ItemSearch items={items} exclude={lines.map((l) => l.itemId)} onPick={(i) => setLines((ls) => [...ls, { itemId: i.id, qty: '' }])} testID="usage-search" />
          <LineList lines={lines} items={items} errors={lineErrors} testID="usage"
            onQty={(itemId, v) => setLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, qty: v } : l)))}
            onRemove={(itemId) => setLines((ls) => ls.filter((l) => l.itemId !== itemId))} />
          <TextField label="Note (optional)" value={note} onChangeText={setNote} testID="usage-note" />
          {error ? <ErrorBanner message={error} testID="usage-error" /> : null}
          <View style={styles.two}>
            <Button title="Save" onPress={save} loading={busy} testID="usage-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} testID="usage-cancel" />
          </View>
        </View>
      ) : null}
      {rows && rows.length === 0 && !adding ? <EmptyState title="Nothing installed yet" /> : null}
      {rows?.map((u) => (
        <View key={u.id} style={styles.card} testID={`usage-entry-${u.id}`}>
          <Text style={styles.title}>{formatDate(u.date)}{u.area ? ` · ${u.area}` : ''}</Text>
          {u.lines.map((l) => <Text key={l.workOrderItemId} style={styles.line}>{l.serialNo}. {l.description}: {formatNumber(l.qty)} {l.unit}</Text>)}
          <Text style={styles.muted}>by {u.createdBy?.name ?? '—'}{u.note ? ` · ${u.note}` : ''}</Text>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  ok: { fontSize: 14, color: colors.success, fontWeight: '700' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  two: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 140 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  line: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
