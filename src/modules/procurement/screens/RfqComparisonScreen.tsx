import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors } from '../../../shared/designSystem';
import { procurementApi } from '../api/procurementApi';
import { label } from '../types';
import { Loading, Section, errorText, printDoc, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'RfqComparison'>;
const key = (lineId: string, quoteId: string) => `${lineId}:${quoteId}`;

export function RfqComparisonScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const fetcher = useCallback(() => procurementApi.comparison(id), [id]);
  const { data: cmp, error, reload } = useLoad(fetcher);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState('');
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { if (cmp) setRemarks(cmp.rfq.evaluationRemarks); }, [cmp]);

  const select = async () => {
    setProblem('');
    const allocations = Object.entries(alloc).map(([k, v]) => { const [requisitionLineId, quoteId] = k.split(':'); return { requisitionLineId, quoteId, qty: parseNumber(v) ?? 0 }; }).filter((a) => a.qty > 0);
    if (!allocations.length) return setProblem('Enter the quantity to buy from at least one supplier');
    if (justification.trim().length < 10) return setProblem('Explain why these suppliers were chosen (price, quality, delivery, terms)');
    setBusy('select');
    try {
      const sel = await procurementApi.select(id, { justification: justification.trim(), allocations });
      navigation.navigate('SelectionDetail', { id: sel.id });
    } catch (e) { setProblem(errorText(e)); } finally { setBusy(''); }
  };
  const saveRemarks = async () => { setBusy('remarks'); try { await procurementApi.saveEvaluation(id, remarks); } catch (e) { setProblem(errorText(e)); } finally { setBusy(''); } };

  return (
    <AppScreen title={cmp ? `Compare ${cmp.rfq.number}` : 'Comparative statement'} subtitle="Lowest landed cost is highlighted; you choose — and justify — the supplier for each item" onBack={() => navigation.navigate('RfqDetail', { id })} testID="comparison-screen"
      right={<Button title="Print statement" variant="outline" onPress={() => printDoc('comparison', id).catch((e) => setProblem(errorText(e)))} />}>
      <Loading error={error} onRetry={reload} loaded={Boolean(cmp)} />
      {problem ? <ErrorBanner message={problem} testID="cmp-problem" /> : null}
      {cmp ? (
        <>
          {cmp.missingQuotations.length ? <Text style={styles.warn}>No quotation yet from: {cmp.missingQuotations.join(', ')}</Text> : null}
          <Section title="Suppliers">
            {cmp.suppliers.map((s) => (
              <View key={s.vendorId} style={[styles.card, s.vendorId === cmp.lowestTotalVendorId && { borderColor: colors.success }]}>
                <View style={styles.row}><Text style={styles.title}>{s.vendorName}</Text><StatusChip label={label(s.status)} tone={s.quote ? 'success' : 'neutral'} />{s.vendorId === cmp.lowestTotalVendorId ? <StatusChip label="Lowest total" tone="success" /> : null}</View>
                {s.quote ? <Text style={styles.muted}>{s.quote.number} v{s.quote.version} · total {formatMoney(s.quote.total)} (taxable {formatMoney(s.quote.taxable)} + GST {formatMoney(s.quote.gst)} + freight {formatMoney(s.quote.freight + s.quote.other)}) · {s.quote.deliveryDays ?? '—'} days · {s.quote.paymentTerms || 'terms —'} · valid {formatDate(s.quote.validUntil)}{s.quote.expired ? ' (EXPIRED)' : ''}{s.quote.coversAll ? '' : ' · partial quote'}</Text> : <Text style={styles.muted}>{s.declineReason ?? 'No quotation'}</Text>}
              </View>
            ))}
          </Section>
          {cmp.lines.map((l) => (
            <Section key={l.requisitionLineId} title={`S.No ${l.serialNo} ${l.description} — ${formatNumber(l.qty)} ${l.unit}`}>
              {l.offers.length === 0 ? <Text style={styles.muted}>Nobody quoted this item.</Text> : null}
              {l.offers.map((o) => (
                <View key={o.quoteId} style={[styles.row, o.lowest && { backgroundColor: '#E7F6EC' }]} testID={`offer-${l.serialNo}-${o.vendorName}`}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Buy all quoted quantity from ${o.vendorName}`} style={styles.cell} onPress={() => setAlloc((a) => ({ ...a, [key(l.requisitionLineId, o.quoteId)]: String(o.qty) }))}>
                    <Text style={styles.title}>{o.vendorName}{o.lowest ? ' · lowest' : ''}{o.expired ? ' · expired' : ''}</Text>
                    <Text style={styles.muted}>{formatNumber(o.qty)} @ {formatMoney(o.rate)} · disc {formatMoney(o.discount)} · GST {o.taxPercent}% · landed {formatMoney(o.landed)} ({formatMoney(o.landedPerUnit)}/{l.unit})</Text>
                  </Pressable>
                  {cmp.rfq.status !== 'cancelled' && !o.expired ? <TextField label="Buy qty" value={alloc[key(l.requisitionLineId, o.quoteId)] ?? ''} onChangeText={(v) => setAlloc((a) => ({ ...a, [key(l.requisitionLineId, o.quoteId)]: v }))} keyboardType="decimal-pad" testID={`alloc-${l.serialNo}-${o.vendorName}`} /> : null}
                </View>
              ))}
            </Section>
          ))}
          <Section title="Evaluation remarks">
            <TextField label="Technical / commercial evaluation" value={remarks} onChangeText={setRemarks} multiline />
            <Button title="Save remarks" variant="outline" onPress={saveRemarks} loading={busy === 'remarks'} />
          </Section>
          <Section title="Select suppliers">
            <TextField label="Selection justification" value={justification} onChangeText={setJustification} multiline placeholder="Price, quality, delivery time, payment terms, technical suitability" testID="cmp-justification" />
            <Button title="Submit selection" onPress={select} loading={busy === 'select'} testID="cmp-select" />
          </Section>
          {cmp.selections.length ? (
            <Section title="Selections">
              {cmp.selections.map((s) => <Pressable key={s.id} accessibilityRole="link" onPress={() => navigation.navigate('SelectionDetail', { id: s.id })}><Text style={styles.number}>{s.number} · {label(s.status)} · {formatMoney(s.amount)}</Text></Pressable>)}
            </Section>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}
