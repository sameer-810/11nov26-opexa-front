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
import { invoiceApi, openPrint, STATUS_LABEL, STATUS_TONE, type Invoice } from '../invoiceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>;

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
        <Text style={styles.muted}>Date {formatDate(inv.invoiceDate)} · {inv.basis === 'lots' ? `lots billed: ${inv.lotIds.length}` : inv.basis === 'installed' ? 'installed work' : 'entered by hand'}</Text>
      </View>
      {inv.status === 'cancelled' ? <Text style={styles.bad}>Cancelled: {inv.cancelReason}</Text> : null}

      <View style={styles.box}>
        {inv.lines.map((l) => (
          <View key={l.id} style={styles.line} testID={`inv-detail-line-${l.serialNo}`}>
            <Text style={styles.text}>{l.serialNo}. {l.description}</Text>
            <Text style={styles.muted}>{formatNumber(l.qty)} {l.unit} × {formatMoney(l.rate)} = {formatMoney(l.amount)}</Text>
            {l.overBoq ? <Text style={styles.warn}>Beyond BOQ ({formatNumber(l.boqQty)}, billed before {formatNumber(l.billedBefore)}) - billed {l.overBoqChoice === 'boq' ? 'as per BOQ' : 'actual'}</Text> : null}
          </View>
        ))}
        <View style={styles.sum}><Text style={styles.text}>Taxable</Text><Text style={styles.text}>{formatMoney(inv.taxable)}</Text></View>
        {inv.interState ? <View style={styles.sum}><Text style={styles.text}>IGST {inv.gstRate}%</Text><Text style={styles.text}>{formatMoney(inv.igst)}</Text></View> : (
          <>
            <View style={styles.sum}><Text style={styles.text}>CGST {inv.gstRate / 2}%</Text><Text style={styles.text}>{formatMoney(inv.cgst)}</Text></View>
            <View style={styles.sum}><Text style={styles.text}>SGST {inv.gstRate / 2}%</Text><Text style={styles.text}>{formatMoney(inv.sgst)}</Text></View>
          </>
        )}
        {inv.roundOff ? <View style={styles.sum}><Text style={styles.muted}>Round off</Text><Text style={styles.muted}>{formatMoney(inv.roundOff)}</Text></View> : null}
        <View style={styles.sum}><Text style={styles.bold}>Total</Text><Text style={styles.bold} testID="inv-total">{formatMoney(inv.total)}</Text></View>
        <Text style={styles.muted}>{inv.totalInWords}</Text>
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
        {inv.status === 'draft' ? <Button title="Issue invoice" onPress={() => act('issue', () => invoiceApi.issue(id))} loading={busy === 'issue'} testID="inv-issue" /> : null}
        {canChange ? <Button title={inv.status === 'issued' ? 'Change (MD/accountant)' : 'Edit'} variant="outline" onPress={() => navigation.navigate('InvoiceForm', { projectId: inv.project.id, invoiceId: inv.id })} testID="inv-edit" /> : null}
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
