import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatDate, todayLocal } from '../../../shared/format';
import { useAuth } from '../../../shared/store/useAuthStore';
import { approvalApi, type Delegation, type Person } from '../api/approvalApi';
import { roleName } from '../components/ApprovalHistory';

type Props = NativeStackScreenProps<RootStackParamList, 'Delegations'>;
type Data = { given: Delegation[]; received: Delegation[]; people: Person[] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const inDays = (n: number) => todayLocal(new Date(Date.now() + n * 86400000));

// Hand your approvals to a colleague for some days (leave, travel), see who stands in for whom, and end it early.
export function DelegationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(inDays(7));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [mine, people] = await Promise.all([approvalApi.delegations(), approvalApi.people()]);
      setData({ ...mine, people });
    } catch (e) { setLoadError(e instanceof ApiError ? e.message : 'Could not load delegations'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setError(''); setBusy(key);
    try { await fn(); await load(); return true; } catch (e) { setError(e instanceof ApiError ? e.message : 'Try again'); return false; } finally { setBusy(''); }
  };
  const create = async () => {
    if (!delegateId) return setError('Choose who will approve for you');
    if (!DATE.test(from) || !DATE.test(to)) return setError('Dates must be YYYY-MM-DD');
    if (to < from) return setError('The last day must be on or after the first day');
    const startsAt = new Date(`${from}T00:00:00`).toISOString();
    const endsAt = new Date(`${to}T23:59:59`).toISOString();
    if (await run('create', () => approvalApi.delegate({ delegateId, startsAt, endsAt }))) setDelegateId('');
  };

  const back = () => navigation.navigate('Approvals');
  if (loadError) return <AppScreen title="Delegate approvals" onBack={back}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!data) return <AppScreen title="Delegate approvals" onBack={back}><ActivityIndicator /></AppScreen>;
  const candidates = data.people.filter((p) => p.canApprove && p.id !== user?.id);

  const row = (d: Delegation, given: boolean) => (
    <View key={d.id} style={styles.card} testID={`delegation-${d.id}`}>
      <View style={styles.row}>
        <Text style={styles.name}>{given ? `To ${d.delegate.name}` : `For ${d.delegator.name}`}</Text>
        <StatusChip label={d.active ? 'Active' : 'Upcoming'} tone={d.active ? 'success' : 'info'} />
      </View>
      <Text style={styles.muted}>{formatDate(d.startsAt)} to {formatDate(d.endsAt)}{d.transactionType === 'all' ? '' : ` · ${d.transactionType.replace(/_/g, ' ')} only`}</Text>
      {given ? <Button title="End now" variant="outline" onPress={() => run(d.id, () => approvalApi.endDelegation(d.id))} loading={busy === d.id} testID={`end-delegation-${d.id}`} /> : null}
    </View>
  );

  return (
    <AppScreen title="Delegate approvals" subtitle="Someone approves for you while you are away; both names are kept on every decision" onBack={back} testID="delegations-screen">
      {error ? <ErrorBanner message={error} testID="delegation-error" /> : null}
      <View style={styles.card}>
        <Text style={styles.section}>New delegation</Text>
        {candidates.length ? (
          <ChoiceChips label="Who approves for you" value={delegateId} onChange={setDelegateId} options={candidates.map((p) => ({ value: p.id, label: p.name, hint: roleName(p.role) }))} testID="delegate-to" />
        ) : <Text style={styles.muted}>Nobody else in the company can approve yet.</Text>}
        <View style={styles.row}>
          <TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} maxLength={10} testID="delegate-from" />
          <TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} maxLength={10} testID="delegate-to-date" />
        </View>
        <Button title="Delegate" onPress={create} loading={busy === 'create'} testID="delegate-save" />
      </View>
      <Text style={styles.section}>You delegated</Text>
      {data.given.length ? data.given.map((d) => row(d, true)) : <Text style={styles.muted} testID="no-given">No delegations from you.</Text>}
      <Text style={styles.section}>You approve for</Text>
      {data.received.length ? data.received.map((d) => row(d, false)) : <Text style={styles.muted} testID="no-received">Nobody has delegated to you.</Text>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.textMuted },
});
