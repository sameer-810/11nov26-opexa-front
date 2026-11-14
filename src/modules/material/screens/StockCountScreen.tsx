import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDateTime, formatMoney, formatNumber, parseNumber } from '../../../shared/format';
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
import type { MaterialRow } from '../../receiving/types';
import { materialApi } from '../api/materialApi';
import { submitOrQueue } from '../../../shared/offline/outbox';
import type { StockCount } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'StockCount'>;
type Entry = { counted: string; reason: string };

// Physical count at site vs what the books say should be there.
export function StockCountScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [rows, setRows] = useState<MaterialRow[] | null>(null);
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [mayCount, setMayCount] = useState(false);
  const [counting, setCounting] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [note, setNote] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(route.params.countId ?? null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [m, c, p] = await Promise.all([receivingApi.material(id), materialApi.counts(id), projectApi.get(id)]);
      // Only items that ever came to site need counting.
      setRows(m.items.filter((r) => r.netSupplied > 0 || r.atSite !== 0));
      setCounts(c);
      setMayCount(canRecordAtSite(user, p.memberIds));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id, user]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const start = () => {
    setEntries(Object.fromEntries((rows ?? []).map((r) => [r.workOrderItemId, { counted: String(Math.max(0, r.atSite)), reason: '' }])));
    setCounting(true);
    setError('');
  };
  const set = (itemId: string, k: keyof Entry) => (v: string) => setEntries((e) => ({ ...e, [itemId]: { ...e[itemId], [k]: v } }));

  const save = async () => {
    setError('');
    const errs: Record<string, string> = {};
    const lines = (rows ?? []).map((r) => {
      const e = entries[r.workOrderItemId];
      const n = parseNumber(e?.counted ?? '');
      if (n === null || n < 0) errs[r.workOrderItemId] = 'Enter the counted quantity';
      else if (n !== r.atSite && e.reason.trim().length < 3) errs[r.workOrderItemId] = 'Count differs from the books - say why';
      return { workOrderItemId: r.workOrderItemId, countedQty: n ?? 0, reason: e?.reason.trim() || undefined };
    });
    setLineErrors(errs);
    if (Object.keys(errs).length) return setError('Please fix the highlighted items');
    setBusy(true);
    try {
      const r = await submitOrQueue<StockCount>('Stock count', 'POST', `/projects/${id}/stock-counts`, { note: note.trim() || undefined, lines });
      setCounting(false);
      if (r.queued) setError('No network. The count is saved on this phone and will be sent when you are back online.');
      else setOpen(r.data.id);
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
    <AppScreen title="Stock count" subtitle="Count what is lying at site and compare with the books" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="stock-count-screen">
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {!rows && !loadError ? <ActivityIndicator /> : null}
      {rows && rows.length === 0 ? <EmptyState title="Nothing has come to site yet" /> : null}
      {rows && rows.length > 0 && mayCount && !counting ? <Button title="Start a count" onPress={start} testID="sc-start" style={styles.self} /> : null}
      {counting && rows ? (
        <View style={styles.gap}>
          <Text style={styles.text}>The numbers start at what the books say. Change only what you counted differently.</Text>
          {rows.map((r) => {
            const e = entries[r.workOrderItemId];
            const n = parseNumber(e?.counted ?? '');
            const diff = n === null ? 0 : n - r.atSite;
            return (
              <View key={r.workOrderItemId} style={styles.card} testID={`sc-line-${r.serialNo}`}>
                <Text style={styles.title}>{r.serialNo}. {r.description}</Text>
                <Text style={styles.muted}>Books: {formatNumber(r.atSite)} {r.unit} (in {formatNumber(r.received + r.localPurchased + r.transferredIn)}, returned {formatNumber(r.returned)}, installed {formatNumber(r.installed)})</Text>
                <View style={styles.row}>
                  <TextInput value={e?.counted ?? ''} onChangeText={set(r.workOrderItemId, 'counted')} keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`sc-count-${r.serialNo}`} />
                  <Text style={diff ? styles.bad : styles.muted}>{diff ? `${diff > 0 ? '+' : ''}${formatNumber(diff)} ${r.unit}` : 'matches'}</Text>
                </View>
                {diff ? <TextInput value={e?.reason ?? ''} onChangeText={set(r.workOrderItemId, 'reason')} placeholder="Why is it different? e.g. wastage, missing" style={[styles.input, styles.wide]} testID={`sc-reason-${r.serialNo}`} /> : null}
                {lineErrors[r.workOrderItemId] ? <Text style={styles.err}>{lineErrors[r.workOrderItemId]}</Text> : null}
              </View>
            );
          })}
          <TextField label="Note (optional)" value={note} onChangeText={setNote} testID="sc-note" />
          {error ? <ErrorBanner message={error} testID="sc-error" /> : null}
          <View style={styles.row}>
            <Button title="Save count" onPress={save} loading={busy} testID="sc-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setCounting(false)} testID="sc-cancel" />
          </View>
        </View>
      ) : null}

      {counts.length ? <Text style={styles.h2}>Past counts</Text> : null}
      {counts.map((c) => {
        const off = c.lines.filter((l) => l.variance !== 0);
        return (
          <View key={c.id} style={styles.card} testID={`sc-${c.number}`}>
            <Text style={styles.title} onPress={() => setOpen(open === c.id ? null : c.id)}>
              {c.number} · {formatDateTime(c.countedAt)} · {off.length ? `${off.length} item(s) differ, ${formatMoney(c.varianceValue)}` : 'all matched'}
            </Text>
            <Text style={styles.muted}>by {c.createdBy?.name ?? '—'}{c.note ? ` · ${c.note}` : ''}</Text>
            {open === c.id ? c.lines.map((l) => (
              <Text key={l.workOrderItemId} style={l.variance ? styles.bad : styles.text}>
                {l.serialNo}. {l.description}: books {formatNumber(l.expectedQty)}, counted {formatNumber(l.countedQty)}{l.variance ? ` (${l.variance > 0 ? '+' : ''}${formatNumber(l.variance)}, ${formatMoney(l.varianceValue)}) - ${l.reason}` : ''}
              </Text>
            )) : null}
          </View>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  gap: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  bad: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  err: { fontSize: 13, color: colors.danger },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, minWidth: 110, color: colors.text },
  wide: { alignSelf: 'stretch' },
});
