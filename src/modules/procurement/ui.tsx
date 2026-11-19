import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../../shared/api/apiClient';
import { ErrorState } from '../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../shared/designSystem';
import { openPrint } from '../invoice/invoiceApi';
import { procurementApi } from './api/procurementApi';
import type { HistoryEntry } from './types';
import { formatDateTime } from '../../shared/format';

export const errorText = (e: unknown, fallback = 'Something went wrong') => {
  if (!(e instanceof ApiError)) return fallback;
  return e.details.length ? `${e.message}: ${e.details.map((d) => d.message).join('; ')}` : e.message;
};

// Loads on focus and exposes reload; screens render <Loading/> until data or error arrives.
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try { setData(await fn()); } catch (e) { setError(errorText(e, 'Could not load')); }
  }, [fn]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return { data, error, reload, setData };
}

export function Loading({ error, onRetry, loaded }: { error: string; onRetry: () => void; loaded: boolean }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return loaded ? null : <ActivityIndicator accessibilityLabel="Loading" />;
}

export function Section({ title, children, right, testID }: { title: string; children: ReactNode; right?: ReactNode; testID?: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>{right}</View>
      {children}
    </View>
  );
}

export function Stat({ label, value, onPress, tone, testID }: { label: string; value: string | number; onPress?: () => void; tone?: 'danger' | 'warning'; testID?: string }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${label}: ${value}`} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]} testID={testID}>
      <Text style={[styles.statValue, tone === 'danger' && { color: colors.danger }, tone === 'warning' && { color: '#B45309' }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

export function History({ rows }: { rows?: HistoryEntry[] }) {
  if (!rows?.length) return null;
  return (
    <Section title="History">
      {rows.map((h, i) => <Text key={`${h.at}-${i}`} style={styles.muted}>{formatDateTime(h.at)} · {h.action.replace(/_/g, ' ')}{h.by ? ` · ${h.by}` : ''}{h.detail ? ` — ${h.detail}` : ''}</Text>)}
    </Section>
  );
}

export async function printDoc(kind: 'rfq' | 'comparison' | 'po', id: string) {
  const { url } = await procurementApi.printLink(kind, id);
  await openPrint(url);
}

export const styles = StyleSheet.create({
  section: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  stat: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 13, color: colors.textMuted },
  pressed: { backgroundColor: colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  number: { fontSize: 15, fontWeight: '800', color: colors.primary },
  muted: { fontSize: 13, color: colors.textMuted },
  cell: { flexGrow: 1, flexBasis: 140 },
  list: { gap: spacing.sm },
  warn: { fontSize: 13, color: '#B45309' },
  danger: { fontSize: 13, color: colors.danger },
});
