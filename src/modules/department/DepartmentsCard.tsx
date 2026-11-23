import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../shared/api/apiClient';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { StatusChip } from '../../shared/ui/StatusChip';
import { ErrorBanner } from '../../shared/ui/Banner';
import { colors, radius, spacing } from '../../shared/designSystem';
import { departmentApi, type Department } from './departmentApi';

// Department master (Q9): add departments and switch them off or on. Never deleted, so old records stay readable.
export function DepartmentsCard() {
  const [items, setItems] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setItems(await departmentApi.list(true)); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load departments'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(''); setBusy(true);
    try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Try again'); } finally { setBusy(false); }
  };
  const add = () => (name.trim().length < 2 ? setError('Enter a department name') : run(async () => { await departmentApi.create({ name: name.trim() }); setName(''); }));

  return (
    <View style={styles.card} testID="departments-card">
      <Text style={styles.title}>Departments</Text>
      {items.map((d) => (
        <View key={d.id} style={styles.row} testID={`department-${d.code}`}>
          <Text style={styles.name}>{d.name} · {d.code}</Text>
          <StatusChip label={d.isActive ? 'Active' : 'Off'} tone={d.isActive ? 'success' : 'neutral'} />
          <Button title={d.isActive ? 'Switch off' : 'Switch on'} variant="ghost" onPress={() => run(() => departmentApi.update(d.id, { isActive: !d.isActive }))} testID={`department-toggle-${d.code}`} />
        </View>
      ))}
      <View style={styles.row}>
        <TextField label="New department" value={name} onChangeText={setName} maxLength={80} testID="department-name" />
        <Button title="Add" onPress={add} loading={busy} testID="department-add" />
      </View>
      {error ? <ErrorBanner message={error} testID="department-error" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, flexGrow: 1 },
});
