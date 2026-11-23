import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { api, ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi, type PickedFile } from '../../requisition/api/requisitionApi';
import { AttachmentPicker } from '../../requisition/components/Attachments';
import type { Requisition, RequisitionLine } from '../../requisition/types';
import { challanApi } from '../api/challanApi';

type Props = NativeStackScreenProps<RootStackParamList, 'MaterialReceived'>;
type Vendor = { id: string; name: string };

const receivable = (l: RequisitionLine) => l.receivable ?? Math.max(0, (l.qtyApproved ?? l.qtyRequested) - (l.received ?? 0));

// "Material received" on an approved MR: quantity per item, delivery details, then OK and Create challan (Q7).
export function MaterialReceivedScreen({ navigation, route }: Props) {
  const { requisitionId } = route.params;
  const { user } = useAuth();
  const [req, setReq] = useState<Requisition | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [vendorId, setVendorId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [vendorChallanNo, setVendorChallanNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [receivedByName, setReceivedByName] = useState(user?.name ?? '');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requisitionApi.get(requisitionId).then(setReq).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the request'));
    api<Vendor[]>('/vendors/names').then(setVendors).catch(() => undefined);
  }, [requisitionId]);

  const back = () => navigation.navigate('RequisitionDetail', { id: requisitionId });
  if (!req) return <AppScreen title="Material received" onBack={back}>{error ? <ErrorBanner message={error} /> : <ActivityIndicator />}</AppScreen>;

  const lines = req.lines.filter((l) => l.status !== 'rejected');
  const entered = lines.map((l) => ({ l, q: parseNumber(qty[l.id] ?? '') ?? 0 })).filter((x) => x.q > 0);

  const check = () => {
    setError('');
    const le: Record<string, string> = {};
    for (const l of lines) {
      const raw = (qty[l.id] ?? '').trim();
      const q = raw ? parseNumber(raw) : 0;
      if (q === null || q < 0) le[l.id] = 'Enter a quantity (0 if nothing came)';
      else if (q > receivable(l) + 1e-9) le[l.id] = `Only ${formatNumber(receivable(l))} ${l.unit} pending`;
    }
    setLineErrors(le);
    if (Object.keys(le).length) return setError('Please fix the highlighted quantities');
    if (!entered.length) return setError('Enter the quantity received for at least one item');
    setConfirming(true);
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const vendor = vendors.find((v) => v.id === vendorId);
      const dc = await challanApi.create({
        requisitionId,
        lines: entered.map((x) => ({ lineId: x.l.id, qty: x.q })),
        ...(vendor ? { vendorId: vendor.id } : {}),
        supplierName: supplierName.trim() || vendor?.name || undefined,
        vendorChallanNo: vendorChallanNo.trim() || undefined,
        vehicleNo: vehicleNo.trim() || undefined,
        receivedByName: receivedByName.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      let failed = 0;
      for (const p of picked) await challanApi.addAttachment(dc.id, p).catch(() => { failed += 1; });
      navigation.replace('ChallanDetail', { id: dc.id, justCreated: true, ...(failed ? { attachFailed: failed } : {}) });
    } catch (e) {
      if (e instanceof ApiError) {
        setLineErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
        setConfirming(false);
      } else setError('Something went wrong');
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <AppScreen title="Check and create the challan" subtitle={`${req.number} · ${req.projectCode} ${req.projectName}`} onBack={() => setConfirming(false)} testID="material-received-confirm">
        {entered.map(({ l, q }) => (
          <View key={l.id} style={styles.card} testID={`mr-confirm-${l.serialNo}`}>
            <Text style={styles.title}>{l.serialNo}. {l.description}</Text>
            <Text style={styles.text}>Received now {formatNumber(q)} {l.unit} · pending after this {formatNumber(Math.max(0, (l.pending ?? 0) - q))}</Text>
          </View>
        ))}
        <Text style={styles.muted}>{[supplierName || vendors.find((v) => v.id === vendorId)?.name, vendorChallanNo && `supplier challan ${vendorChallanNo}`, vehicleNo && `vehicle ${vehicleNo}`, picked.length ? `${picked.length} attachment(s)` : null].filter(Boolean).join(' · ')}</Text>
        {error ? <ErrorBanner message={error} testID="mr-recv-error" /> : null}
        <View style={styles.row}>
          <Button title="Create challan" onPress={create} loading={busy} testID="mr-recv-create" />
          <Button title="Change" variant="ghost" onPress={() => setConfirming(false)} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Material received" subtitle={`${req.number} · ${req.projectCode} ${req.projectName}`} onBack={back} testID="material-received-screen">
      {req.deliveryAddress ? <Text style={styles.text}>Delivered to: {req.deliveryAddress}</Text> : null}
      {lines.map((l) => (
        <View key={l.id} style={styles.card} testID={`mr-recv-line-${l.serialNo}`}>
          <Text style={styles.title}>{l.serialNo}. {l.description}</Text>
          {l.specification ? <Text style={styles.muted}>Spec: {l.specification}</Text> : null}
          <Text style={styles.text}>
            Requested {formatNumber(l.qtyRequested)} · approved {formatNumber(l.qtyApproved ?? l.qtyRequested)} · delivered {formatNumber(l.received ?? 0)} · pending {formatNumber(l.pending ?? 0)} {l.unit}
          </Text>
          {(l.inTransit ?? 0) > 0 ? <Text style={styles.muted}>{formatNumber(l.inTransit ?? 0)} {l.unit} is on the way on a supplier lot: check it in on the lot.</Text> : null}
          <View style={styles.row}>
            <TextInput value={qty[l.id] ?? ''} onChangeText={(v) => setQty((s) => ({ ...s, [l.id]: v }))} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" editable={receivable(l) > 0}
              style={styles.input} testID={`mr-recv-qty-${l.serialNo}`} accessibilityLabel={`Quantity received for ${l.description}`} />
            <Text style={styles.muted}>{l.unit} received now (up to {formatNumber(receivable(l))})</Text>
          </View>
          {lineErrors[l.id] ? <Text style={styles.err}>{lineErrors[l.id]}</Text> : null}
        </View>
      ))}
      {vendors.length ? (
        <ChoiceChips label="Supplier (optional)" value={vendorId} onChange={(v) => setVendorId(v === vendorId ? '' : v)} testID="mr-recv-vendor" options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
      ) : null}
      <TextField label="Supplier name (if not in the list, or our store)" value={supplierName} onChangeText={setSupplierName} testID="mr-recv-supplier" />
      <TextField label="Supplier challan no. (reference)" value={vendorChallanNo} onChangeText={setVendorChallanNo} testID="mr-recv-vendor-challan" />
      <TextField label="Vehicle no." value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" testID="mr-recv-vehicle" />
      <TextField label="Received by" value={receivedByName} onChangeText={setReceivedByName} testID="mr-recv-received-by" />
      <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline testID="mr-recv-remarks" />
      <AttachmentPicker picked={picked} onPick={setPicked} />
      {error ? <ErrorBanner message={error} testID="mr-recv-error" /> : null}
      <Button title="OK" onPress={check} testID="mr-recv-ok" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  err: { fontSize: 13, color: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, minWidth: 110, color: colors.text },
  self: { alignSelf: 'flex-start' },
});
