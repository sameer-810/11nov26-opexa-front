import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatMoney, formatNumber, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { invoiceApi, type Basis, type Invoice, type Preview } from '../invoiceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceForm'>;
type Row = { qty: string; rate: string; choice?: 'boq' | 'actual' };
type Question = { field: string; serialNo: string; boqQty: number; billedBefore: number; qty: number; boqLimitQty: number; message: string };
const today = () => todayLocal();

// New invoice for a project, or edit an existing one (issued ones need a reason).
export function InvoiceFormScreen({ navigation, route }: Props) {
  const { projectId, invoiceId } = route.params;
  const { user } = useAuth();
  const mayRate = can(user, PERMS.INVOICE_EDIT);
  const [existing, setExisting] = useState<Invoice | null>(null);
  const [basis, setBasis] = useState<Basis>('lots');
  const [lotIds, setLotIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [date, setDate] = useState(today());
  const [gst, setGst] = useState('18');
  const [inter, setInter] = useState('same');
  const [client, setClient] = useState({ gstin: '', state: '', address: '' });
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Editing: start from the saved invoice.
  useEffect(() => {
    if (!invoiceId) return;
    invoiceApi.get(invoiceId).then((inv) => {
      setExisting(inv);
      setBasis(inv.basis);
      setLotIds(inv.lotIds);
      setDate(inv.invoiceDate);
      setGst(String(inv.gstRate));
      setInter(inv.interState ? 'other' : 'same');
      setClient({ gstin: inv.client.gstin, state: inv.client.state, address: inv.client.address });
      setNotes(inv.notes);
      setRows(Object.fromEntries(inv.lines.map((l) => [l.workOrderItemId, { qty: String(l.qty), rate: String(l.rate), choice: l.overBoqChoice ?? undefined }])));
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, [invoiceId]);

  const loadPreview = useCallback(async () => {
    try {
      const p = await invoiceApi.preview(projectId, basis, lotIds);
      setPreview(p);
      if (!invoiceId) {
        setRows(Object.fromEntries(p.lines.map((l) => [l.workOrderItemId, { qty: l.suggestedQty ? String(l.suggestedQty) : '', rate: String(l.rate) }])));
        setClient((c) => ({ gstin: c.gstin || p.project.clientGstin, state: c.state || p.project.clientState, address: c.address || p.project.billingAddress }));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [projectId, basis, lotIds, invoiceId]);
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const set = (id: string, k: keyof Row, v: string) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const lines = useMemo(() => (preview?.lines ?? []).filter((l) => (parseNumber(rows[l.workOrderItemId]?.qty ?? '') ?? 0) > 0), [preview, rows]);
  const taxable = lines.reduce((s, l) => s + (parseNumber(rows[l.workOrderItemId]?.qty ?? '') ?? 0) * (parseNumber(rows[l.workOrderItemId]?.rate ?? '') ?? l.rate), 0);

  const save = async () => {
    setError('');
    if (!lines.length) return setError('Enter a quantity for at least one item');
    if (basis === 'lots' && !lotIds.length) return setError('Choose the lots to bill');
    if (existing?.status === 'issued' && reason.trim().length < 3) return setError('Give a reason for changing an issued invoice');
    setBusy(true);
    const body = {
      projectId, basis, lotIds: basis === 'lots' ? lotIds : undefined, invoiceDate: date, gstRate: Number(gst), interState: inter === 'other', notes: notes.trim() || undefined,
      client: { gstin: client.gstin.trim(), state: client.state.trim(), address: client.address.trim() },
      lines: lines.map((l) => {
        const r = rows[l.workOrderItemId];
        const rate = parseNumber(r.rate);
        return { workOrderItemId: l.workOrderItemId, qty: parseNumber(r.qty)!, ...(mayRate && rate !== null && rate !== l.rate ? { rate } : {}), ...(r.choice ? { overBoqChoice: r.choice } : {}) };
      }),
    };
    try {
      const inv = existing ? await invoiceApi.update(existing.id, { ...body, editReason: reason.trim() || undefined }) : await invoiceApi.create(body);
      navigation.replace('InvoiceDetail', { id: inv.id });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'BILL_OVER_BOQ') {
        setQuestions(e.details as unknown as Question[]);
        setError('');
      } else setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy(false);
  };

  // Answer "bill as per BOQ or actual?" for one item, then the person presses Save again.
  const answer = (q: Question, choice: 'boq' | 'actual') => {
    set(q.field, 'choice', choice);
    setQuestions((qs) => qs.filter((x) => x.field !== q.field));
  };

  if (!preview) return <AppScreen title="Invoice" onBack={() => navigation.goBack()}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;
  return (
    <AppScreen title={existing ? `Edit ${existing.label}` : 'New invoice'} subtitle={`${preview.project.code} ${preview.project.name} · ${preview.project.clientName}`} onBack={() => navigation.goBack()} testID="invoice-form-screen">
      {!existing ? (
        <ChoiceChips label="Bill for" value={basis} onChange={(v) => { setBasis(v as Basis); setQuestions([]); }} testID="inv-basis"
          options={[{ value: 'lots', label: 'Delivered lots' }, { value: 'installed', label: 'Installed work' }, { value: 'manual', label: 'Enter myself' }]} />
      ) : null}
      {basis === 'lots' ? (
        <View style={styles.box}>
          <Text style={styles.title}>Lots</Text>
          {preview.lots.filter((l) => l.received).length === 0 ? <Text style={styles.muted}>No lot has been checked in at site yet.</Text> : null}
          {preview.lots.map((l) => {
            const on = lotIds.includes(l.id);
            const off = !l.received || (!!l.billedOn && !existing?.lotIds.includes(l.id));
            return (
              <Pressable key={l.id} disabled={off || !!existing} onPress={() => setLotIds((ids) => (on ? ids.filter((x) => x !== l.id) : [...ids, l.id]))} style={[styles.lot, on && styles.lotOn, off && styles.lotOff]} testID={`inv-lot-${l.lotNo}`}>
                <Text style={styles.text}>{on ? '☑' : '☐'} Lot {l.lotNo} · challan {l.challanNo}{!l.received ? ' · not checked in' : l.billedOn && !existing?.lotIds.includes(l.id) ? ` · on ${l.billedOn}` : ''}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.box}>
        <Text style={styles.title}>Items</Text>
        {preview.lines.map((l) => {
          const r = rows[l.workOrderItemId] ?? { qty: '', rate: String(l.rate) };
          const qn = questions.find((x) => x.field === l.workOrderItemId);
          return (
            <View key={l.workOrderItemId} style={styles.line} testID={`inv-line-${l.serialNo}`}>
              <Text style={styles.text}>{l.serialNo}. {l.description}</Text>
              <Text style={styles.muted}>BOQ {formatNumber(l.boqQty)} {l.unit} · billed before {formatNumber(l.billedBefore)}{basis !== 'manual' ? ` · ready to bill ${formatNumber(l.suggestedQty)}` : ''}</Text>
              <View style={styles.row}>
                <TextInput value={r.qty} onChangeText={(v) => { set(l.workOrderItemId, 'qty', v); set(l.workOrderItemId, 'choice', ''); }} placeholder="Qty" keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`inv-qty-${l.serialNo}`} />
                <Text style={styles.muted}>× ₹</Text>
                <TextInput value={r.rate} editable={mayRate} onChangeText={(v) => set(l.workOrderItemId, 'rate', v)} keyboardType="decimal-pad" inputMode="decimal" style={[styles.input, !mayRate && styles.locked]} testID={`inv-rate-${l.serialNo}`} />
              </View>
              {r.choice ? <Text style={styles.chosen} testID={`inv-choice-${l.serialNo}`}>Beyond BOQ - billing {r.choice === 'boq' ? 'as per BOQ' : 'actual quantity'}</Text> : null}
              {qn ? (
                <View style={styles.ask} testID={`inv-ask-${l.serialNo}`}>
                  <Text style={styles.askText}>{qn.message}</Text>
                  <View style={styles.row}>
                    <Button title={`Bill ${formatNumber(qn.boqLimitQty)} (BOQ)`} variant="outline" onPress={() => answer(qn, 'boq')} testID={`inv-ask-boq-${l.serialNo}`} />
                    <Button title={`Bill ${formatNumber(qn.qty)} (actual)`} onPress={() => answer(qn, 'actual')} testID={`inv-ask-actual-${l.serialNo}`} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        {!mayRate ? <Text style={styles.muted}>Rates come from the BOQ. Only the MD or accountant can change them.</Text> : null}
      </View>

      <View style={styles.box}>
        <View style={styles.row}>
          <View style={styles.cell}><TextField label="Invoice date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="inv-date" /></View>
          <View style={styles.cell}><ChoiceChips label="GST %" value={gst} onChange={setGst} testID="inv-gst" options={['18', '12', '5', '28', '0'].map((g) => ({ value: g, label: `${g}%` }))} /></View>
        </View>
        <ChoiceChips label="Client is in" value={inter} onChange={setInter} testID="inv-inter" options={[{ value: 'same', label: 'Same state (CGST + SGST)' }, { value: 'other', label: 'Other state (IGST)' }]} />
        <View style={styles.row}>
          <View style={styles.cell}><TextField label="Client GSTIN" value={client.gstin} onChangeText={(v) => setClient({ ...client, gstin: v.toUpperCase() })} testID="inv-gstin" /></View>
          <View style={styles.cell}><TextField label="Place of supply (state)" value={client.state} onChangeText={(v) => setClient({ ...client, state: v })} testID="inv-state" /></View>
        </View>
        <TextField label="Billing address" value={client.address} onChangeText={(v) => setClient({ ...client, address: v })} testID="inv-address" />
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} testID="inv-notes" />
        {existing?.status === 'issued' ? <TextField label="Reason for change (kept in the log)" value={reason} onChangeText={setReason} testID="inv-reason" /> : null}
      </View>
      <Text style={styles.total} testID="inv-estimate">Taxable {formatMoney(taxable)} + GST {gst}% ≈ {formatMoney(taxable * (1 + Number(gst) / 100))}</Text>
      {questions.length ? <ErrorBanner message="Some items go beyond the BOQ. Choose what to bill for each, then save again." testID="inv-questions" /> : null}
      {error ? <ErrorBanner message={error} testID="inv-error" /> : null}
      <Button title={existing ? 'Save changes' : 'Save draft'} onPress={save} loading={busy} testID="inv-save" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  lot: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm },
  lotOn: { borderColor: colors.primary, backgroundColor: '#EEF4FF' },
  lotOff: { opacity: 0.5 },
  line: { borderBottomWidth: 1, borderColor: colors.border, paddingBottom: spacing.sm, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 180 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, minWidth: 110, color: colors.text },
  locked: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  chosen: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  ask: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  askText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '800', color: colors.text },
  self: { alignSelf: 'flex-start' },
});
