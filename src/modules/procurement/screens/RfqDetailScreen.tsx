import { useCallback, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { env } from '../../../config/env';
import { formatDateTime, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import { QuoteForm } from '../components/QuoteForm';
import { RFQ_TONE, label, type Rfq, type SupplierLink } from '../types';
import { History, Loading, Section, errorText, printDoc, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'RfqDetail'>;
const portalUrl = (path: string) => `${env.apiUrl}${path}`;

// The buyer's own mail app sends the link; no external mail service is involved.
const mailLink = (rfq: Rfq, l: SupplierLink) => `mailto:${l.email ?? ''}?subject=${encodeURIComponent(`Request for quotation ${rfq.number}`)}&body=${encodeURIComponent(`Please submit your quotation for ${rfq.number} before ${formatDateTime(rfq.deadline)} using this private link:\n${portalUrl(l.portalPath)}\n\nThe link is only for your company and expires at the deadline.`)}`;

export function RfqDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const fetcher = useCallback(() => procurementApi.rfq(id), [id]);
  const { data: rfq, error, reload } = useLoad(fetcher);
  const [links, setLinks] = useState<SupplierLink[]>(() => (route.params.links ? JSON.parse(route.params.links) : []));
  const [mode, setMode] = useState<'' | 'quote' | 'cancel' | 'decline'>('');
  const [reason, setReason] = useState('');
  const [declineFor, setDeclineFor] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setProblem('');
    try { await fn(); setMode(''); setReason(''); await reload(); } catch (e) { setProblem(errorText(e)); } finally { setBusy(''); }
  };
  const newLink = (vendorId: string) => run(`link-${vendorId}`, async () => { const l = await procurementApi.supplierLink(id, vendorId); setLinks((ls) => [...ls.filter((x) => x.vendorId !== vendorId), l]); });

  return (
    <AppScreen title={rfq ? rfq.number : 'RFQ'} subtitle={rfq ? `${rfq.requisitionNumber ?? ''} · ${rfq.projectCode ?? ''} ${rfq.projectName ?? ''}` : ''} onBack={() => navigation.navigate('Rfqs')} testID="rfq-detail"
      right={rfq ? <StatusChip label={label(rfq.status)} tone={RFQ_TONE[rfq.status]} testID="rfq-status" /> : null}>
      <Loading error={error} onRetry={reload} loaded={Boolean(rfq)} />
      {problem ? <ErrorBanner message={problem} testID="rfq-problem" /> : null}
      {rfq ? (
        <>
          <Text style={styles.muted}>Quote by {formatDateTime(rfq.deadline)}{rfq.deadlinePassed ? ' (passed)' : ''} · deliver to {rfq.deliveryLocation || '—'}{rfq.paymentTerms ? ` · ${rfq.paymentTerms}` : ''}</Text>
          <View style={styles.row}>
            {rfq.status === 'draft' ? <Button title="Send to suppliers" onPress={() => run('publish', async () => setLinks((await procurementApi.publishRfq(id)).links ?? []))} loading={busy === 'publish'} testID="rfq-publish" /> : null}
            {rfq.status === 'sent' ? <Button title="Record quotation" variant="outline" onPress={() => setMode('quote')} testID="rfq-add-quote" /> : null}
            {rfq.status === 'sent' ? <Button title="Close quotations" variant="outline" onPress={() => run('close', () => procurementApi.closeRfq(id))} loading={busy === 'close'} testID="rfq-close" /> : null}
            {(rfq.quotations?.length ?? 0) > 0 ? <Button title="Compare and select" onPress={() => navigation.navigate('RfqComparison', { id })} testID="rfq-compare" /> : null}
            <Button title="Print RFQ" variant="ghost" onPress={() => printDoc('rfq', id).catch((e) => setProblem(errorText(e)))} />
            {['draft', 'sent'].includes(rfq.status) ? <Button title="Cancel RFQ" variant="ghost" onPress={() => setMode('cancel')} /> : null}
          </View>
          {mode === 'cancel' || mode === 'decline' ? (
            <Section title={mode === 'cancel' ? 'Cancel this RFQ' : 'Supplier declined'}>
              <TextField label="Reason" value={reason} onChangeText={setReason} testID="rfq-reason" />
              <View style={styles.row}>
                <Button title="Confirm" onPress={() => run('reason', () => (mode === 'cancel' ? procurementApi.cancelRfq(id, reason) : procurementApi.decline(id, declineFor, reason)))} loading={busy === 'reason'} testID="rfq-reason-ok" />
                <Button title="Back" variant="ghost" onPress={() => setMode('')} />
              </View>
            </Section>
          ) : null}
          {mode === 'quote' ? <QuoteForm rfq={rfq} onSaved={() => { setMode(''); void reload(); }} onCancel={() => setMode('')} /> : null}
          <Section title="Suppliers">
            {links.length ? <Text style={styles.warn}>Copy or e-mail each supplier its private link now. Links are shown only once; issue a new link if one is lost.</Text> : null}
            {rfq.suppliers.map((s) => {
              const link = links.find((l) => l.vendorId === s.vendorId);
              return (
                <View key={s.vendorId} style={styles.card} testID={`rfq-sup-${s.vendorName}`}>
                  <View style={styles.row}><Text style={styles.title}>{s.vendorName}</Text><StatusChip label={label(s.status)} tone={s.status === 'quoted' ? 'success' : s.status === 'declined' ? 'neutral' : 'warning'} /></View>
                  <Text style={styles.muted}>{s.sentAt ? `Sent ${formatDateTime(s.sentAt)}` : 'Not sent'} · link {s.linkActive ? 'active' : 'inactive'}{s.declineReason ? ` · ${s.declineReason}` : ''}</Text>
                  {link ? <Text selectable style={styles.muted} testID={`rfq-link-${s.vendorName}`}>{portalUrl(link.portalPath)}</Text> : null}
                  {rfq.status === 'sent' ? (
                    <View style={styles.row}>
                      {link ? <Button title="E-mail link" variant="outline" onPress={() => Linking.openURL(mailLink(rfq, link))} /> : null}
                      <Button title="New link" variant="ghost" onPress={() => newLink(s.vendorId)} loading={busy === `link-${s.vendorId}`} />
                      {s.status === 'pending' ? <Button title="Mark declined" variant="ghost" onPress={() => { setDeclineFor(s.vendorId); setMode('decline'); }} /> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Section>
          <Section title="Items">
            {rfq.lines.map((l) => <Text key={l.requisitionLineId} style={styles.muted}>S.No {l.serialNo} {l.description} — {l.qty} {l.unit}{l.specification ? ` (${l.specification})` : ''}</Text>)}
          </Section>
          <Section title="Quotations received">
            {!rfq.quotations?.length ? <Text style={styles.muted}>None yet.</Text> : null}
            {rfq.quotations?.map((q) => <Text key={q.id} style={q.isCurrent ? styles.title : styles.muted}>{q.vendorName}: {q.number} v{q.version}{q.isCurrent ? '' : ' (superseded)'} · {formatMoney(q.total)} · {q.source === 'portal' ? 'via portal' : 'entered by buyer'} · {formatDateTime(q.submittedAt ?? q.quoteDate)}</Text>)}
          </Section>
          <History rows={rfq.history} />
        </>
      ) : null}
    </AppScreen>
  );
}
