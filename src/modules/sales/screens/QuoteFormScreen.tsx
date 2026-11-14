import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { quoteTotals, salesApi } from '../salesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'QuoteForm'>;
type Row = { description: string; unit: string; qty: string; rate: string };
const blank = (): Row => ({ description: '', unit: 'Nos', qty: '', rate: '' });
const plus30 = () => { const d = new Date(); d.setDate(d.getDate() + 30); return todayLocal(d); };

export function QuoteFormScreen({ navigation, route }: Props) {
  const { leadId, quoteId } = route.params;
  const [ready, setReady] = useState(!quoteId);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [subject, setSubject] = useState('');
  const [quoteDate, setQuoteDate] = useState(todayLocal());
  const [validTill, setValidTill] = useState(plus30());
  const [gstRate, setGstRate] = useState('18');
  const [discount, setDiscount] = useState('');
  const [terms, setTerms] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    salesApi.lead(leadId).then((l) => {
      const q = l.quotes?.find((x) => x.id === quoteId);
      if (q) {
        setRows(q.lines.map((x) => ({ description: x.description, unit: x.unit, qty: String(x.qty), rate: String(x.rate) })));
        setSubject(q.subject); setQuoteDate(q.quoteDate); setValidTill(q.validTill ?? ''); setGstRate(String(q.gstRate)); setDiscount(q.discount ? String(q.discount) : ''); setTerms(q.terms);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [leadId, quoteId]);

  const setRow = (i: number, k: keyof Row) => (v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const parsed = rows.map((r) => ({ description: r.description.trim(), unit: r.unit.trim(), qty: parseNumber(r.qty) ?? 0, rate: parseNumber(r.rate) ?? 0 }));
  const disc = parseNumber(discount || '0') ?? 0;
  const t = quoteTotals(parsed, disc, Number(gstRate));

  const save = async () => {
    setError('');
    const used = rows.map((r, i) => ({ r, p: parsed[i] })).filter(({ r }) => r.description.trim() || r.qty.trim() || r.rate.trim());
    const bad = used.find(({ r }) => parseNumber(r.qty) === null || parseNumber(r.rate || '0') === null);
    if (bad) return setError(`Check quantity and rate for "${bad.r.description || 'a row'}"`);
    if (parseNumber(discount || '0') === null) return setError('Discount must be a number');
    setBusy(true);
    try {
      const body = { quoteDate, validTill: validTill.trim() || undefined, subject: subject.trim() || undefined, lines: used.map(({ p }) => p), gstRate: Number(gstRate), discount: disc, terms: terms.trim() || undefined };
      if (quoteId) await salesApi.updateQuote(quoteId, body);
      else await salesApi.createQuote(leadId, body);
      navigation.navigate('LeadDetail', { id: leadId });
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => `${d.field}: ${d.message}`)].join(' - ') : 'Could not save');
    }
    setBusy(false);
  };

  if (!ready) return <AppScreen title="Quotation"><ActivityIndicator /></AppScreen>;
  return (
    <AppScreen title={quoteId ? 'Edit quotation' : 'New quotation'} subtitle="Draft - you can change it until you mark it sent" onBack={() => navigation.navigate('LeadDetail', { id: leadId })} testID="quote-form-screen">
      <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Supply & installation of VRF system" testID="qf-subject" />
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Date (YYYY-MM-DD)" value={quoteDate} onChangeText={setQuoteDate} testID="qf-date" /></View>
        <View style={styles.grow}><TextField label="Valid till" value={validTill} onChangeText={setValidTill} testID="qf-valid" /></View>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.line} testID={`qf-line-${i}`}>
          <View style={styles.between}>
            <Text style={styles.bold}>Item {i + 1}</Text>
            {rows.length > 1 ? <Text style={styles.remove} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} testID={`qf-remove-${i}`}>Remove</Text> : null}
          </View>
          <TextField label="Description" value={r.description} onChangeText={setRow(i, 'description')} testID={`qf-desc-${i}`} />
          <View style={styles.row}>
            <View style={styles.small}><TextField label="Unit" value={r.unit} onChangeText={setRow(i, 'unit')} testID={`qf-unit-${i}`} /></View>
            <View style={styles.small}><TextField label="Qty" value={r.qty} onChangeText={setRow(i, 'qty')} keyboardType="decimal-pad" testID={`qf-qty-${i}`} /></View>
            <View style={styles.small}><TextField label="Rate (₹)" value={r.rate} onChangeText={setRow(i, 'rate')} keyboardType="decimal-pad" testID={`qf-rate-${i}`} /></View>
            <Text style={styles.amount}>{formatMoney(parsed[i].qty * parsed[i].rate)}</Text>
          </View>
        </View>
      ))}
      <Button title="Add item" variant="outline" onPress={() => setRows((r) => [...r, blank()])} testID="qf-add" style={styles.self} />
      <ChoiceChips label="GST" options={['0', '5', '12', '18', '28'].map((v) => ({ value: v, label: `${v}%` }))} value={gstRate} onChange={setGstRate} testID="qf-gst" />
      <TextField label="Discount (₹, optional)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" testID="qf-discount" />
      <View style={styles.box} testID="qf-totals">
        <View style={styles.between}><Text style={styles.text}>Items</Text><Text style={styles.text}>{formatMoney(t.gross)}</Text></View>
        {disc ? <View style={styles.between}><Text style={styles.text}>Discount</Text><Text style={styles.text}>− {formatMoney(disc)}</Text></View> : null}
        <View style={styles.between}><Text style={styles.text}>GST {gstRate}%</Text><Text style={styles.text}>{formatMoney(t.gst)}</Text></View>
        <View style={styles.between}><Text style={styles.bold}>Total</Text><Text style={styles.bold} testID="qf-total">{formatMoney(t.total)}</Text></View>
      </View>
      <TextField label="Terms & conditions (blank = company default)" value={terms} onChangeText={setTerms} multiline testID="qf-terms" />
      {error ? <ErrorBanner message={error} testID="qf-error" /> : null}
      <Button title="Save draft" onPress={save} loading={busy} testID="qf-save" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'flex-end' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  grow: { flexGrow: 1, minWidth: 160 },
  small: { flexGrow: 1, minWidth: 90, flexBasis: 90 },
  line: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  box: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: spacing.md, gap: 4 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text, paddingBottom: 12, minWidth: 110, textAlign: 'right' },
  remove: { color: colors.danger, fontSize: 13 },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  self: { alignSelf: 'flex-start' },
});
