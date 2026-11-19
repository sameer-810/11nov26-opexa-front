import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors } from '../../../shared/designSystem';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import { vendorApi } from '../../vendor/api/vendorApi';
import { procurementApi } from '../api/procurementApi';
import { Loading, Section, errorText, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'NewRfq'>;
const inDays = (n: number) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

export function NewRfqScreen({ navigation, route }: Props) {
  const { requisitionId } = route.params;
  const fetcher = useCallback(async () => {
    const [req, vendors] = await Promise.all([requisitionApi.get(requisitionId), vendorApi.list()]);
    return { req, vendors: vendors.filter((v) => v.isActive) };
  }, [requisitionId]);
  const { data, error, reload } = useLoad(fetcher);
  const [picked, setPicked] = useState<string[]>([]);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState(inDays(3));
  const [paymentTerms, setPaymentTerms] = useState('');
  const [terms, setTerms] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const open = data?.req.lines.filter((l) => (l.toOrder ?? 0) > 0) ?? [];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async (publish: boolean) => {
    setProblem('');
    if (!picked.length) return setProblem('Choose at least one supplier');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return setProblem('Enter the deadline as YYYY-MM-DD');
    const lines = open.map((l) => ({ requisitionLineId: l.id, qty: parseNumber(qtys[l.id] ?? String(l.toOrder)) ?? 0 })).filter((l) => l.qty > 0);
    if (!lines.length) return setProblem('Enter a quantity for at least one item');
    setBusy(true);
    try {
      const rfq = await procurementApi.createRfq({ requisitionId, vendorIds: picked, deadline: `${deadline}T18:00:00+05:30`, paymentTerms, terms, publish, lines });
      navigation.replace('RfqDetail', { id: rfq.id, links: rfq.links?.length ? JSON.stringify(rfq.links) : undefined });
    } catch (e) { setProblem(errorText(e)); setBusy(false); }
  };

  return (
    <AppScreen title="Request quotations" subtitle={data ? `${data.req.number} · ${data.req.projectName ?? ''}` : ''} onBack={() => navigation.goBack()} testID="new-rfq-screen">
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {problem ? <ErrorBanner message={problem} testID="rfq-error" /> : null}
      {data && data.req.status !== 'open' ? <ErrorBanner message="This request is not approved for purchase yet." /> : null}
      {data ? (
        <>
          <Section title="Items (approved quantity not yet ordered)">
            {open.length === 0 ? <Text style={styles.muted}>Everything on this request is already ordered.</Text> : null}
            {open.map((l) => (
              <View key={l.id} style={styles.row}>
                <Text style={[styles.title, styles.cell]}>S.No {l.serialNo} {l.description} · up to {formatNumber(l.toOrder ?? 0)} {l.unit}</Text>
                <TextField label={`Quantity (${l.unit})`} value={qtys[l.id] ?? String(l.toOrder ?? '')} onChangeText={(v) => setQtys((q) => ({ ...q, [l.id]: v }))} keyboardType="decimal-pad" testID={`rfq-qty-${l.serialNo}`} />
              </View>
            ))}
          </Section>
          <Section title={`Suppliers (${picked.length} chosen)`}>
            <View style={styles.row}>
              {data.vendors.map((v) => {
                const on = picked.includes(v.id);
                return (
                  <Pressable key={v.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(v.id)} testID={`rfq-vendor-${v.name}`}
                    style={[styles.card, on && { borderColor: colors.primary, backgroundColor: '#EEF4FF' }]}>
                    <Text style={styles.title}>{on ? '✓ ' : ''}{v.name}</Text>
                    <Text style={styles.muted}>{v.email ?? 'no email'}{v.category ? ` · ${v.category}` : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
          <Section title="Terms">
            <TextField label="Quote by (YYYY-MM-DD, 6 pm)" value={deadline} onChangeText={setDeadline} testID="rfq-deadline" />
            <TextField label="Payment terms asked" value={paymentTerms} onChangeText={setPaymentTerms} placeholder="e.g. 30 days from delivery" />
            <TextField label="Terms and conditions" value={terms} onChangeText={setTerms} multiline />
          </Section>
          <View style={styles.row}>
            <Button title="Send to suppliers" onPress={() => submit(true)} loading={busy} testID="rfq-send" />
            <Button title="Save as draft" variant="outline" onPress={() => submit(false)} disabled={busy} testID="rfq-draft" />
          </View>
        </>
      ) : null}
    </AppScreen>
  );
}
