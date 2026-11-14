import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatDateTime, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { openPrint } from '../../invoice/invoiceApi';
import { QUOTE_LABEL, salesApi, SOURCES, STAGE_LABEL, STAGE_TONE, STAGES, type Lead, type Quote } from '../salesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'LeadDetail'>;

export function LeadDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const canCreateProject = can(user, PERMS.PROJECT_MANAGE);
  const [lead, setLead] = useState<Lead | null>(null);
  const [note, setNote] = useState('');
  const [follow, setFollow] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [askLost, setAskLost] = useState(false);
  const [winQuote, setWinQuote] = useState<Quote | null>(null);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setLead(await salesApi.lead(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const act = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setError('');
    setBusy(key);
    try {
      await fn();
      after?.();
      setLead(await salesApi.lead(id));
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy('');
  };

  if (!lead) return <AppScreen title="Enquiry" onBack={() => navigation.navigate('Sales')}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;
  const closed = lead.status === 'won' || lead.status === 'lost';
  const quotes = lead.quotes ?? [];
  const hasDraft = quotes.some((q) => q.status === 'draft');

  const changeStage = (s: string) => {
    if (s === lead.status) return;
    if (s === 'lost') return setAskLost(true);
    void act('stage', () => salesApi.update(id, { status: s as Lead['status'] }));
  };

  return (
    <AppScreen title={`${lead.number} · ${lead.clientName}`} subtitle={SOURCES.find((s) => s.value === lead.source)?.label} onBack={() => navigation.navigate('Sales')} testID="lead-screen">
      <View style={styles.row}>
        <StatusChip label={STAGE_LABEL[lead.status]} tone={STAGE_TONE[lead.status]} testID="ld-status" />
        {lead.followUpDue ? <StatusChip label="Follow-up due" tone="danger" testID="ld-due" /> : null}
        {lead.nextFollowUp && !closed ? <Text style={styles.muted}>Next follow-up {formatDate(lead.nextFollowUp)}</Text> : null}
      </View>
      <View style={styles.box}>
        {lead.contactName ? <Text style={styles.text}>{lead.contactName}</Text> : null}
        {lead.phone ? <Text style={styles.link} onPress={() => Linking.openURL(`tel:${lead.phone.replace(/\s/g, '')}`)} testID="ld-call">Call {lead.phone}</Text> : null}
        {lead.email ? <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${lead.email}`)}>{lead.email}</Text> : null}
        {lead.siteAddress ? <Text style={styles.muted}>Site: {lead.siteAddress}</Text> : null}
        {lead.requirement ? <Text style={styles.text}>{lead.requirement}</Text> : null}
        <Text style={styles.muted}>Estimate {formatMoney(lead.estValue)}{lead.owner ? ` · handled by ${lead.owner.name}` : ''}</Text>
        {lead.status === 'lost' ? <Text style={styles.bad}>Lost: {lead.lostReason}</Text> : null}
        {lead.projectId ? <Button title="Open project" variant="outline" onPress={() => navigation.navigate('ProjectDetail', { id: lead.projectId! })} testID="ld-project" style={styles.self} /> : null}
      </View>

      {!closed ? <ChoiceChips label="Stage" options={STAGES.filter((s) => s.value !== 'won')} value={lead.status} onChange={changeStage} testID="ld-stage" /> : null}
      {lead.status === 'lost' ? <Button title="Reopen enquiry" variant="outline" onPress={() => act('reopen', () => salesApi.update(id, { status: 'contacted' }))} loading={busy === 'reopen'} testID="ld-reopen" style={styles.self} /> : null}
      {askLost ? (
        <View style={styles.box}>
          <TextField label="Why was it lost?" value={lostReason} onChangeText={setLostReason} placeholder="e.g. price, went with another contractor" testID="ld-lost-reason" />
          <Button title="Mark lost" variant="outline" onPress={() => act('lost', () => salesApi.update(id, { status: 'lost', lostReason: lostReason.trim() }), () => setAskLost(false))} loading={busy === 'lost'} testID="ld-lost-save" style={styles.self} />
        </View>
      ) : null}

      <View style={styles.box}>
        <View style={styles.between}>
          <Text style={styles.title}>Quotations</Text>
          {!closed && !hasDraft ? <Button title={quotes.length ? 'New quotation' : 'Make quotation'} onPress={() => navigation.navigate('QuoteForm', { leadId: id })} testID="ld-new-quote" /> : null}
        </View>
        {!quotes.length ? <Text style={styles.muted}>No quotation yet</Text> : null}
        {quotes.map((q) => (
          <View key={q.id} style={styles.quote} testID={`ld-quote-${q.label}`}>
            <View style={styles.row}>
              <Text style={styles.bold}>{q.label}</Text>
              <StatusChip label={QUOTE_LABEL[q.status]} tone={q.status === 'accepted' ? 'success' : q.status === 'draft' ? 'warning' : q.status === 'sent' ? 'info' : 'neutral'} />
              <Text style={styles.text}>{formatMoney(q.total)}</Text>
              <Text style={styles.muted}>{formatDate(q.quoteDate)} · {q.lines.length} item(s)</Text>
            </View>
            {q.status !== 'superseded' ? (
              <View style={styles.row}>
                <Button title="Print / PDF" variant="outline" onPress={() => act(`print-${q.id}`, async () => openPrint((await salesApi.printLink(q.id)).url))} loading={busy === `print-${q.id}`} testID={`ld-print-${q.label}`} />
                {q.status === 'draft' ? <Button title="Edit" variant="outline" onPress={() => navigation.navigate('QuoteForm', { leadId: id, quoteId: q.id })} testID={`ld-edit-${q.label}`} /> : null}
                {q.status === 'draft' ? <Button title="Mark sent" onPress={() => act(`send-${q.id}`, () => salesApi.send(q.id))} loading={busy === `send-${q.id}`} testID={`ld-send-${q.label}`} /> : null}
                {q.status === 'sent' && !closed ? <Button title="Revise" variant="outline" onPress={() => act(`rev-${q.id}`, async () => { const r = await salesApi.revise(q.id); navigation.navigate('QuoteForm', { leadId: id, quoteId: r.id }); })} loading={busy === `rev-${q.id}`} disabled={hasDraft} testID={`ld-revise-${q.label}`} /> : null}
                {q.status === 'sent' && !closed && canCreateProject ? <Button title="Order won" onPress={() => { setWinQuote(q); setProjectName(`${lead.clientName}${q.subject ? ` - ${q.subject}` : ''}`.slice(0, 120)); }} testID={`ld-won-${q.label}`} /> : null}
              </View>
            ) : null}
          </View>
        ))}
        {winQuote ? (
          <View style={styles.win} testID="ld-win-box">
            <Text style={styles.text}>This creates a new project with {winQuote.lines.length} BOQ line(s) from {winQuote.label} ({formatMoney(winQuote.total)}).</Text>
            <TextField label="Project name" value={projectName} onChangeText={setProjectName} testID="ld-project-name" />
            <View style={styles.row}>
              <Button title="Create project" onPress={() => act('won', async () => { const r = await salesApi.convert(id, winQuote.id, projectName.trim() || undefined); setWinQuote(null); navigation.navigate('ProjectDetail', { id: r.projectId }); })} loading={busy === 'won'} testID="ld-convert" />
              <Button title="Cancel" variant="ghost" onPress={() => setWinQuote(null)} />
            </View>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} testID="ld-error" /> : null}

      {!closed ? (
        <View style={styles.box}>
          <Text style={styles.title}>Add a note</Text>
          <TextField label="What happened?" value={note} onChangeText={setNote} multiline placeholder="e.g. Called Mr Rao, wants revised rate for indoor units" testID="ld-note" />
          <TextField label="Next follow-up (YYYY-MM-DD, optional)" value={follow} onChangeText={setFollow} testID="ld-follow" />
          <Button title="Save note" onPress={() => act('note', () => salesApi.note(id, note.trim(), follow.trim() || undefined), () => { setNote(''); setFollow(''); })} loading={busy === 'note'} testID="ld-save-note" style={styles.self} />
        </View>
      ) : null}

      <View style={styles.box} testID="ld-history">
        <Text style={styles.title}>History</Text>
        {(lead.notes ?? []).map((n, i) => <Text key={i} style={styles.muted}>{formatDateTime(n.at)} · {n.byName}: <Text style={styles.text}>{n.text}</Text></Text>)}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  quote: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  win: { backgroundColor: '#ECFDF5', borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  bad: { fontSize: 14, color: colors.danger, fontWeight: '700' },
  link: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  self: { alignSelf: 'flex-start' },
});
