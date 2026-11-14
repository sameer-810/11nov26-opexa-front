import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatMoney, formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import type { Requisition } from '../../requisition/types';
import { vendorApi } from '../../vendor/api/vendorApi';
import { VendorForm } from '../../vendor/VendorForm';
import type { Vendor } from '../../vendor/types';
import { purchaseOrderApi } from '../api/purchaseOrderApi';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPurchaseOrder'>;

export function NewPurchaseOrderScreen({ navigation, route }: Props) {
  const { requisitionId } = route.params;
  const [req, setReq] = useState<Requisition | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([requisitionApi.get(requisitionId), vendorApi.list()])
      .then(([r, v]) => {
        setReq(r);
        setVendors(v.filter((x) => x.isActive));
        // Start with everything still to order.
        setQtys(Object.fromEntries(r.lines.filter((l) => (l.toOrder ?? 0) > 0).map((l) => [l.id, String(l.toOrder)])));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, [requisitionId]);

  const back = () => navigation.navigate('RequisitionDetail', { id: requisitionId });
  if (!req) return <AppScreen title="New purchase order" onBack={back}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;

  const open = req.lines.filter((l) => (l.toOrder ?? 0) > 0);
  const chosen = open.map((l) => ({ l, qty: parseNumber(qtys[l.id] ?? '') ?? 0, rate: parseNumber(rates[l.id] ?? '') })).filter((x) => x.qty > 0);
  const total = chosen.reduce((s, x) => s + x.qty * (x.rate ?? 0), 0);

  const submit = async () => {
    setError('');
    setLineErrors({});
    if (!vendorId) return setError('Choose a vendor');
    if (!chosen.length) return setError('Enter a quantity for at least one item');
    const tooMuch = chosen.filter((x) => x.qty > (x.l.toOrder ?? 0));
    if (tooMuch.length) {
      setLineErrors(Object.fromEntries(tooMuch.map((x) => [x.l.id, `Only ${formatNumber(x.l.toOrder ?? 0)} left to order`])));
      return setError('Some quantities are more than what is left to order');
    }
    setBusy(true);
    try {
      const po = await purchaseOrderApi.create({
        requisitionId,
        vendorId,
        lines: chosen.map((x) => ({ requisitionLineId: x.l.id, qty: x.qty, ...(x.rate !== null ? { rate: x.rate } : {}) })),
        notes: notes.trim() || undefined,
      });
      navigation.replace('PurchaseOrderDetail', { id: po.id });
    } catch (e) {
      if (e instanceof ApiError) {
        setLineErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
      } else setError('Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AppScreen title="New purchase order" subtitle={`For ${req.number} · ${req.projectCode} ${req.projectName}`} onBack={back} testID="new-po-screen">
      {vendors.length ? (
        <ChoiceChips label="Vendor" testID="po-vendor" value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.id, label: v.name, hint: v.phone ?? undefined }))} />
      ) : (
        <Text style={styles.muted}>No vendors yet. Add one below.</Text>
      )}
      {addingVendor ? (
        <VendorForm onCancel={() => setAddingVendor(false)} onSaved={(v) => { setVendors((x) => [...x, v]); setVendorId(v.id); setAddingVendor(false); }} />
      ) : (
        <Button title="Add a new vendor" variant="ghost" onPress={() => setAddingVendor(true)} testID="po-add-vendor" style={styles.self} />
      )}

      <Text style={styles.section}>Items</Text>
      <Text style={styles.muted}>Order part of a line from this vendor and the rest from another, if needed. Rate defaults to the BOQ rate.</Text>
      {open.length === 0 ? <Text style={styles.muted}>Everything on this request has been ordered.</Text> : null}
      {open.map((l) => (
        <View key={l.id} style={styles.item} testID={`po-item-${l.serialNo}`}>
          <View style={styles.flex}>
            <Text style={styles.itemTitle}>{l.serialNo}. {l.description}</Text>
            <Text style={styles.muted}>Requested {formatNumber(l.qtyRequested)} {l.unit} · ordered {formatNumber(l.ordered ?? 0)} · left {formatNumber(l.toOrder ?? 0)}</Text>
            {lineErrors[l.id] ? <Text style={styles.err}>{lineErrors[l.id]}</Text> : null}
          </View>
          <View style={styles.inputs}>
            <View>
              <Text style={styles.small}>Qty ({l.unit})</Text>
              <TextInput value={qtys[l.id] ?? ''} onChangeText={(v) => setQtys((q) => ({ ...q, [l.id]: v }))} keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`po-qty-${l.serialNo}`} />
            </View>
            <View>
              <Text style={styles.small}>Rate ₹</Text>
              <TextInput value={rates[l.id] ?? ''} onChangeText={(v) => setRates((r) => ({ ...r, [l.id]: v }))} placeholder="BOQ" keyboardType="decimal-pad" inputMode="decimal" style={styles.input} testID={`po-rate-${l.serialNo}`} />
            </View>
          </View>
        </View>
      ))}
      <TextField label="Notes for the vendor (optional)" value={notes} onChangeText={setNotes} multiline />
      {total > 0 ? <Text style={styles.total}>Total at entered rates: {formatMoney(total)}</Text> : null}
      {error ? <ErrorBanner message={error} testID="po-error" /> : null}
      <Button title={`Raise purchase order (${chosen.length} item${chosen.length === 1 ? '' : 's'})`} onPress={submit} loading={busy} testID="po-submit" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: colors.textMuted },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 220, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  inputs: { flexDirection: 'row', gap: spacing.sm },
  small: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  input: { width: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: 15, textAlign: 'right', color: colors.text },
  err: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '700', color: colors.text },
  self: { alignSelf: 'flex-start' },
});
