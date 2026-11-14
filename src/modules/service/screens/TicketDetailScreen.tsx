import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatDateTime, formatMoney, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { PRIORITY_LABEL, serviceApi, STATUS_LABEL, STATUS_TONE, type Ticket } from '../api/serviceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'TicketDetail'>;
const SOURCE = { app: 'Logged in app', 'client-link': 'Client sent from link', system: 'Created automatically' } as const;

export function TicketDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const manager = can(user, PERMS.SERVICE_MANAGE);
  const [t, setT] = useState<Ticket | null>(null);
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [parts, setParts] = useState('');
  const [vStatus, setVStatus] = useState<'in-progress' | 'resolved'>('in-progress');
  const [charge, setCharge] = useState('');
  const [rating, setRating] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const r = await serviceApi.ticket(id);
      setT(r);
      setAssignee(r.assignedTo?.id ?? '');
      if (manager) setTechs(await serviceApi.technicians());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id, manager]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const act = async (key: string, fn: () => Promise<Ticket>, after?: () => void) => {
    setError('');
    setBusy(key);
    try {
      setT(await fn());
      after?.();
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy('');
  };

  if (!t) return <AppScreen title="Service job" onBack={() => navigation.navigate('Service')}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;
  const open = !['resolved', 'closed'].includes(t.status);
  const mayCharge = !t.underWarranty || manager;
  const saveVisit = () => {
    const c = charge.trim() ? parseNumber(charge) : undefined;
    if (c === null) return setError('Charge must be a number');
    return act('visit', () => serviceApi.visit(id, { note: note.trim(), partsUsed: parts.trim() || undefined, status: vStatus, charge: c }), () => { setNote(''); setParts(''); setCharge(''); });
  };

  return (
    <AppScreen title={`${t.number} · ${t.title}`} subtitle={`${t.project.code ?? ''} ${t.project.name ?? ''}`} onBack={() => navigation.navigate('Service')} testID="ticket-screen">
      <View style={styles.row}>
        <StatusChip label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} testID="tk-status" />
        <StatusChip label={PRIORITY_LABEL[t.priority]} tone={t.priority === 'urgent' ? 'danger' : 'neutral'} />
        {t.kind === 'preventive' ? <StatusChip label="Preventive maintenance" tone="info" /> : null}
        {t.asset ? <StatusChip label={t.underWarranty ? 'Under warranty - no charge' : 'Warranty over - chargeable'} tone={t.underWarranty ? 'success' : 'warning'} testID="tk-warranty" /> : null}
      </View>
      <View style={styles.box}>
        {t.asset ? <Text style={styles.text}>Unit: {[t.asset.name, t.asset.brand, t.asset.model].filter(Boolean).join(' ')} · S/N {t.asset.serialNo || '-'}{t.asset.location ? ` · ${t.asset.location}` : ''} · warranty till {formatDate(t.asset.warrantyEnd)}</Text> : <Text style={styles.muted}>No specific unit</Text>}
        {t.description ? <Text style={styles.text}>{t.description}</Text> : null}
        {t.contactPhone ? (
          <Text style={styles.link} onPress={() => Linking.openURL(`tel:${t.contactPhone.replace(/\s/g, '')}`)} testID="tk-call">Call {t.contactName || 'client'}: {t.contactPhone}</Text>
        ) : null}
        <Text style={styles.muted}>{SOURCE[t.source]} on {formatDateTime(t.createdAt)} · {t.assignedTo ? `Technician: ${t.assignedTo.name}` : 'Not assigned yet'}</Text>
        {t.charge ? <Text style={styles.text}>Charge: {formatMoney(t.charge)}</Text> : null}
        {t.clientRating ? <Text style={styles.text}>Client rating: {'★'.repeat(t.clientRating)}</Text> : null}
      </View>

      {manager && open ? (
        <View style={styles.box}>
          <ChoiceChips label="Give this job to" options={techs.map((x) => ({ value: x.id, label: x.name }))} value={assignee} onChange={setAssignee} testID="tk-assignee" />
          <Button title={t.assignedTo ? 'Change technician' : 'Assign'} onPress={() => act('assign', () => serviceApi.assign(id, assignee))} loading={busy === 'assign'} disabled={!assignee || assignee === t.assignedTo?.id} testID="tk-assign" style={styles.self} />
        </View>
      ) : null}

      {open && (manager || t.assignedTo?.id === user?.id) ? (
        <View style={styles.box}>
          <Text style={styles.title}>Visit report</Text>
          <TextField label="What did you find and do?" value={note} onChangeText={setNote} multiline testID="tk-note" />
          <TextField label="Parts used (optional)" value={parts} onChangeText={setParts} testID="tk-parts" />
          {mayCharge ? <TextField label="Charge to client (₹, optional)" value={charge} onChangeText={setCharge} keyboardType="decimal-pad" testID="tk-charge" /> : <Text style={styles.muted}>Under warranty - no charge to the client.</Text>}
          <ChoiceChips label="Status after this visit" options={[{ value: 'in-progress', label: 'Still working' }, { value: 'resolved', label: 'Problem solved' }]} value={vStatus} onChange={(v) => setVStatus(v as typeof vStatus)} testID="tk-vstatus" />
          <Button title="Save visit" onPress={saveVisit} loading={busy === 'visit'} testID="tk-save-visit" style={styles.self} />
        </View>
      ) : null}

      {manager && t.status === 'resolved' ? (
        <View style={styles.box}>
          <ChoiceChips label="Client rating (optional)" options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: `${v}★` }))} value={rating} onChange={setRating} testID="tk-rating" />
          <View style={styles.row}>
            <Button title="Close job" onPress={() => act('close', () => serviceApi.close(id, rating ? Number(rating) : undefined))} loading={busy === 'close'} testID="tk-close" />
            <Button title="Not fixed - reopen" variant="outline" onPress={() => act('reopen', () => serviceApi.reopen(id))} loading={busy === 'reopen'} testID="tk-reopen" />
          </View>
        </View>
      ) : null}
      {manager && t.status === 'closed' ? <Button title="Problem came back - reopen" variant="outline" onPress={() => act('reopen', () => serviceApi.reopen(id))} loading={busy === 'reopen'} testID="tk-reopen" style={styles.self} /> : null}
      {error ? <ErrorBanner message={error} testID="tk-error" /> : null}

      <View style={styles.box} testID="tk-history">
        <Text style={styles.title}>History</Text>
        {t.visits.length ? t.visits.map((v, i) => (
          <View key={i} style={styles.visit}>
            <Text style={styles.muted}>{formatDateTime(v.at)} · {v.byName} · {STATUS_LABEL[v.status as keyof typeof STATUS_LABEL] ?? v.status}</Text>
            <Text style={styles.text}>{v.note}{v.partsUsed ? ` (parts: ${v.partsUsed})` : ''}</Text>
          </View>
        )) : <Text style={styles.muted}>No visits yet</Text>}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  visit: { borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 6, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  self: { alignSelf: 'flex-start' },
});
