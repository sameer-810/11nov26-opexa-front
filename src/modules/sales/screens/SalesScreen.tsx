import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatMoney, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { salesApi, STAGE_LABEL, STAGE_TONE, type Lead, type Summary } from '../salesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Sales'>;
const FILTERS = [{ value: 'open', label: 'Open' }, { value: 'due', label: 'Follow-up due' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }, { value: '', label: 'All' }];

export function SalesScreen({ navigation }: Props) {
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [l, s] = await Promise.all([salesApi.leads(filter === 'due' ? { due: true, q } : { status: filter, q }), salesApi.summary()]);
      setRows(l);
      setSum(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [filter, q]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const Stat = ({ label, value, testID, warn }: { label: string; value: string; testID: string; warn?: boolean }) => (
    <View style={styles.stat} testID={testID}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, warn && styles.warn]}>{value}</Text></View>
  );

  return (
    <AppScreen title="Sales" subtitle="Enquiries, quotations and follow-ups" onBack={() => navigation.navigate('Dashboard')} testID="sales-screen">
      {sum ? (
        <View style={styles.stats}>
          <Stat label="Open enquiries" value={`${sum.openCount} · ${formatMoney(sum.openValue)}`} testID="sl-open" />
          <Stat label="Follow-ups due" value={String(sum.followUpsDue)} testID="sl-due" warn={sum.followUpsDue > 0} />
          <Stat label="Won this month" value={formatMoney(sum.wonThisMonth)} testID="sl-won" />
          <Stat label="Win rate" value={sum.winRatePct === null ? '—' : `${sum.winRatePct}%`} testID="sl-rate" />
        </View>
      ) : null}
      <View style={styles.row}>
        <Button title="New enquiry" onPress={() => navigation.navigate('NewLead')} testID="sl-new" />
      </View>
      <ChoiceChips label="Show" options={FILTERS} value={filter} onChange={(v) => { setRows(null); setFilter(v); }} testID="sl-filter" />
      <TextField label="Search" value={q} onChangeText={setQ} placeholder="Client, contact, phone, EN number" testID="sl-search" />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && !rows.length ? <EmptyState title="No enquiries here" /> : null}
      {rows?.map((l) => (
        <Pressable key={l.id} style={styles.card} onPress={() => navigation.navigate('LeadDetail', { id: l.id })} testID={`sl-row-${l.number}`}>
          <View style={styles.row}>
            <Text style={styles.num}>{l.number}</Text>
            <StatusChip label={STAGE_LABEL[l.status]} tone={STAGE_TONE[l.status]} />
            {l.followUpDue ? <StatusChip label={`Follow up ${l.nextFollowUp && l.nextFollowUp < todayLocal() ? `(due ${formatDate(l.nextFollowUp)})` : 'today'}`} tone="danger" /> : null}
          </View>
          <Text style={styles.title}>{l.clientName}</Text>
          <Text style={styles.muted}>
            {[l.contactName, l.phone].filter(Boolean).join(' · ')}{l.requirement ? ` · ${l.requirement}` : ''}
          </Text>
          <Text style={styles.muted}>{l.quotedValue ? `Quoted ${formatMoney(l.quotedValue)}` : l.estValue ? `Estimate ${formatMoney(l.estValue)}` : 'No value yet'}{l.owner ? ` · ${l.owner.name}` : ''}</Text>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, minWidth: 150, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  warn: { color: colors.danger },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  num: { fontSize: 14, fontWeight: '800', color: colors.text },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
