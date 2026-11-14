import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDateTime, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { materialApi } from '../api/materialApi';
import { RETURN_STATUS_LABEL, RETURN_TONE, RETURN_TYPE_LABEL, type MaterialReturn } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnDetail'>;

export function ReturnDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [r, setR] = useState<MaterialReturn | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'accepted' | 'rejected'>('');
  const decider = can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.PURCHASE_MANAGE);

  useEffect(() => {
    materialApi.getReturn(id).then(setR).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, [id]);

  const back = () => (r && !decider ? navigation.navigate('ProjectReturns', { id: r.projectId }) : navigation.navigate('Returns'));
  if (!r) return <AppScreen title="Return" onBack={() => navigation.navigate('Dashboard')}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;

  const decide = async (d: 'accepted' | 'rejected') => {
    if (d === 'rejected' && note.trim().length < 3) return setError('Write why it is rejected');
    setError('');
    setBusy(d);
    try {
      setR(await materialApi.decide(id, d, note.trim() || undefined));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
    setBusy('');
  };

  const dest = r.type === 'transfer' ? r.toProject?.name : r.type === 'vendor' ? r.vendor?.name : 'company store';
  return (
    <AppScreen title={r.number} subtitle={`${RETURN_TYPE_LABEL[r.type]}: ${r.projectName} → ${dest}`} onBack={back} testID="return-detail-screen">
      <View style={styles.row}>
        <StatusChip label={RETURN_STATUS_LABEL[r.status]} tone={RETURN_TONE[r.status]} testID="return-status" />
        <Text style={styles.muted}>Sent {formatDateTime(r.createdAt)} by {r.createdBy?.name ?? '—'}{r.challanNo ? ` · challan ${r.challanNo}` : ''}</Text>
      </View>
      <Text style={styles.text}>Reason: {r.reason}</Text>
      {r.lines.map((l) => (
        <View key={l.id} style={styles.card} testID={`return-line-${l.serialNo}`}>
          <Text style={styles.title}>{l.serialNo}. {l.description}</Text>
          <Text style={styles.text}>{formatNumber(l.qty)} {l.unit}{l.toSerialNo ? ` → S.No ${l.toSerialNo} at ${r.toProject?.name}` : ''}</Text>
        </View>
      ))}
      {r.decidedAt ? (
        <Text style={styles.muted} testID="return-decided">{r.status === 'accepted' ? 'Confirmed' : 'Rejected'} by {r.decidedBy?.name ?? '—'} on {formatDateTime(r.decidedAt)}{r.decisionNote ? ` · "${r.decisionNote}"` : ''}</Text>
      ) : null}
      {r.status === 'pending' && decider ? (
        <View style={styles.box}>
          <Text style={styles.text}>Has it reached {dest}?</Text>
          <TextField label="Note (needed if you reject)" value={note} onChangeText={setNote} testID="return-note" />
          {error ? <ErrorBanner message={error} testID="return-error" /> : null}
          <View style={styles.row}>
            <Button title="Yes, received" onPress={() => decide('accepted')} loading={busy === 'accepted'} testID="return-accept" />
            <Button title="Reject" variant="outline" onPress={() => decide('rejected')} loading={busy === 'rejected'} testID="return-reject" />
          </View>
          <Text style={styles.muted}>Rejecting puts the quantity back into {r.projectName}'s stock.</Text>
        </View>
      ) : null}
      {r.status === 'pending' && !decider ? <Text style={styles.muted}>Waiting for the manager or buyer to confirm.</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
});
