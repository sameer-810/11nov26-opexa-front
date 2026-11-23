import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { invoiceApi, openPrint, STATUS_LABEL, STATUS_TONE, lineGroups, type Invoice } from '../invoiceApi';
import { GstSummary, SlabAmountEditor, SlabNotes } from '../components/InvoiceBilling';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>;
const BASIS_LABEL: Record<string, string> = { installed: 'installed work', manual: 'entered by hand', measurement: 'approved measurement sheets', milestone: 'payment term (billing plan)' };

export function InvoiceDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const md = can(user, PERMS.INVOICE_EDIT);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setInv(await invoiceApi.get(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const act = async (key: string, fn: () => Promise<Invoice | void>) => {
    setError('');
    setBusy(key);
    try {
      const r = await fn();
      if (r) setInv(r);
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy('');
  };

  const attach = () => act('attach', async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const file = Platform.OS === 'web' && a.file ? a.file : { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' };
    return invoiceApi.attach(id, file, a.name);
  });

  if (!inv) return <AppScreen title="Invoice" onBack={() => navigation.navigate('Invoices')}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;
  const canChange = inv.status === 'draft' || (inv.status === 'issued' && md);
  return (
    <AppScreen title={inv.label} subtitle={`${inv.project.code} ${inv.project.name} · ${inv.client.name}`} onBack={() => navigation.navigate('Invoices')} testID="invoice-detail-screen">
      <View style={styles.row}>
        <StatusChip label={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} testID="inv-status" />
        <Text style={styles.muted}>Date {formatDate(inv.invoiceDate)} · {inv.basis === 'lots' ? `lots billed: ${inv.lotIds.length}` : BASIS_LABEL[inv.basis] ?? inv.basis}</Text>
        {inv.invoiceType ? <StatusChip label={inv.invoiceType === 'advance' ? 'Advance invoice' : 'Progress invoice'} tone="neutral" testID="inv-type" /> : null}
        {inv.raLabel ? <StatusChip label={inv.raLabel} tone="neutral" testID="inv-ra" /> : null}
      </View>
      <SlabNotes inv={inv} />
      {inv.status === 'cancelled' ? <Text style={styles.bad}>Cancelled: {inv.cancelReason}</Text> : null}

      <View style={styles.box}>
        {lineGroups(inv.lines).map((g) => (
          <View key={g.key} testID={`inv-group-${g.key}`}>
            {g.title ? <Text style={styles.title}>{g.title}</Text> : null}
            {g.lines.map((l) => (
              <View key={l.id} style={styles.line} testID={`inv-detail-line-${l.serialNo}`}>
                <Text style={styles.text}>{l.serialNo}. {l.description}</Text>
                <Text style={styles.muted}>{formatNumber(l.qty)} {l.unit} × {formatMoney(l.rate)} = {formatMoney(l.amount)}{inv.gstMode === 'line' ? ` · ${l.hsnSac ? `HSN/SAC ${l.hsnSac} · ` : ''}GST ${l.gstRate}%` : ''}</Text>
                {l.overBoq ? <Text style={styles.warn}>Beyond BOQ ({formatNumber(l.boqQty)}, billed before {formatNumber(l.billedBefore)}) - billed {l.overBoqChoice === 'boq' ? 'as per BOQ' : 'actual'}</Text> : null}
              </View>
            ))}
            {g.title ? <View style={styles.sum}><Text style={styles.muted}>Subtotal</Text><Text style={styles.muted} testID={`inv-subtotal-${g.key}`}>{formatMoney(g.lines.reduce((a, l) => a + l.amount, 0))}</Text></View> : null}
          </View>
        ))}
        <View style={styles.sum}><Text style={styles.text}>Taxable</Text><Text style={styles.text}>{formatMoney(inv.taxable)}</Text></View>
        {inv.gstMode === 'line' ? <GstSummary inv={inv} /> : inv.interState ? <View style={styles.sum}><Text style={styles.text}>IGST {inv.gstRate}%</Text><Text style={styles.text}>{formatMoney(inv.igst)}</Text></View> : (
          <>
            <View style={styles.sum}><Text style={styles.text}>CGST {inv.gstRate / 2}%</Text><Text style={styles.text}>{formatMoney(inv.cgst)}</Text></View>
            <View style={styles.sum}><Text style={styles.text}>SGST {inv.gstRate / 2}%</Text><Text style={styles.text}>{formatMoney(inv.sgst)}</Text></View>
          </>
        )}
        {inv.roundOff ? <View style={styles.sum}><Text style={styles.muted}>Round off</Text><Text style={styles.muted}>{formatMoney(inv.roundOff)}</Text></View> : null}
        <View style={styles.sum}><Text style={styles.bold}>Total</Text><Text style={styles.bold} testID="inv-total">{formatMoney(inv.total)}</Text></View>
        <Text style={styles.muted}>{inv.totalInWords}</Text>
        {inv.milestoneLine ? <Text style={styles.text} testID="inv-slab">Payment-term slab: {inv.milestoneLine.description} · billed {formatMoney(inv.milestoneLine.amount)} of {formatMoney(inv.milestoneLine.planAmount)}</Text> : null}
        {inv.retention ? <Text style={styles.muted}>Retention {inv.retentionPct}%: {formatMoney(inv.retention)} held by the client</Text> : null}
        {inv.advanceRecovery ? <Text style={styles.muted} testID="inv-advance-recovery">Advance recovered on this bill: {formatMoney(inv.advanceRecovery)}</Text> : null}
        {inv.status === 'issued' ? <Text style={styles.muted} testID="inv-outstanding">Received {formatMoney((inv.received ?? 0) + (inv.allocated ?? 0))} · TDS {formatMoney(inv.tds ?? 0)}{inv.credited ? ` · credit notes ${formatMoney(inv.credited)}` : ''}{inv.debited ? ` · debit notes ${formatMoney(inv.debited)}` : ''} · outstanding {formatMoney(inv.outstanding ?? 0)}</Text> : null}
        {inv.inTally ? <Text style={styles.warn} testID="inv-in-tally">Exported to Tally: correct it with a credit or debit note, not a revision.</Text> : null}
        {inv.revisions?.length ? <Text style={styles.muted}>{inv.revisions.length} earlier version(s) kept</Text> : null}
        {inv.kind === 'milestone' && md && inv.status !== 'cancelled' && !inv.inTally ? <SlabAmountEditor inv={inv} busy={busy === 'slab'} onSave={(milestoneAmount, editReason) => act('slab', () => invoiceApi.update(id, { milestoneAmount, editReason: editReason || undefined }))} /> : null}
      </View>

      <View style={styles.box}>
        <Text style={styles.title}>Attachments ({inv.attachments.length})</Text>
        {inv.attachments.map((a) => (
          <View key={a.id} style={styles.sum} testID={`inv-att-${a.name}`}>
            <Text style={styles.text}>{a.name} · {Math.ceil(a.size / 1024)} KB</Text>
            {canChange ? <Text style={styles.link} onPress={() => act('rm', () => invoiceApi.removeAttachment(id, a.id))}>Remove</Text> : null}
          </View>
        ))}
        {canChange ? <Button title="Attach challan / photo / PDF" variant="outline" onPress={attach} loading={busy === 'attach'} testID="inv-attach" style={styles.self} /> : null}
      </View>

      {error ? <ErrorBanner message={error} testID="inv-detail-error" /> : null}
      <View style={styles.row}>
        <Button title="Print bundle (invoice + lot reports + photos)" onPress={() => act('print', async () => openPrint((await invoiceApi.printLink(id)).url))} loading={busy === 'print'} testID="inv-print" />
        <Button title="Print RA bill (cover + abstract + back sheets)" variant="outline" onPress={() => act('ra', async () => { const l = await invoiceApi.printLink(id); await openPrint(l.raUrl ?? l.url); })} loading={busy === 'ra'} testID="inv-print-ra" />
        {inv.status === 'draft' ? <Button title="Issue invoice" onPress={() => act('issue', () => invoiceApi.issue(id))} loading={busy === 'issue'} testID="inv-issue" /> : null}
        {inv.status === 'issued' ? <Button title="Raise credit / debit note" variant="outline" onPress={() => navigation.navigate('Notes', { invoiceId: inv.id })} testID="inv-raise-note" /> : null}
        {canChange && !inv.inTally && inv.kind !== 'milestone' ? <Button title={inv.status === 'issued' ? 'Change (MD/accountant)' : 'Edit'} variant="outline" onPress={() => navigation.navigate('InvoiceForm', { projectId: inv.project.id, invoiceId: inv.id })} testID="inv-edit" /> : null}
        {md && inv.status !== 'cancelled' ? <Button title="Cancel invoice" variant="ghost" onPress={() => setShowCancel(true)} testID="inv-cancel" /> : null}
      </View>
      {showCancel ? (
        <View style={styles.box}>
          <TextField label="Why cancel?" value={cancelReason} onChangeText={setCancelReason} testID="inv-cancel-reason" />
          <Button title="Cancel this invoice" variant="outline" onPress={() => act('cancel', async () => { const r = await invoiceApi.cancel(id, cancelReason.trim()); setShowCancel(false); return r; })} loading={busy === 'cancel'} testID="inv-cancel-confirm" style={styles.self} />
        </View>
      ) : null}

      {inv.edits.length ? (
        <View style={styles.box} testID="inv-history">
          <Text style={styles.title}>Change history</Text>
          {inv.edits.map((e, i) => <Text key={i} style={styles.muted}>{formatDateTime(e.at)} · {e.byName}: {e.summary}{e.reason ? ` - "${e.reason}"` : ''}</Text>)}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  line: { borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 6, gap: 2 },
  sum: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  bold: { fontSize: 17, fontWeight: '800', color: colors.text },
  warn: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  bad: { fontSize: 14, color: colors.danger, fontWeight: '700' },
  link: { fontSize: 13, color: colors.danger },
  self: { alignSelf: 'flex-start' },
});
