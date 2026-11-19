import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ApiError } from '../../shared/api/apiClient';
import { colors, radius, spacing } from '../../shared/designSystem';

export const errText = (e: unknown) => (e instanceof ApiError ? (e.details.length ? `${e.message}: ${e.details.map((d) => d.message).join('; ')}` : e.message) : 'Something went wrong');

// Load on mount / when deps change; reload() after an action.
export function useData<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => { setError(''); try { setData(await fn()); } catch (e) { setError(errText(e)); } }, [fn]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload };
}

// Runs an action, reporting its error; returns true on success.
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setProblem('');
    try { await fn(); onDone(); return true; } catch (e) { setProblem(errText(e)); return false; } finally { setBusy(''); }
  };
  return { busy, problem, run, setProblem };
}

export const s = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  number: { fontSize: 15, fontWeight: '800', color: colors.primary },
  muted: { fontSize: 13, color: colors.textMuted },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  danger: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  cell: { flexGrow: 1, flexBasis: 160 },
  form: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: '#F8FAFF' },
});
