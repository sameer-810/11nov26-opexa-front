import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import { label } from '../types';
import { History, Loading, Section, errorText, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectionDetail'>;

export function SelectionDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const fetcher = useCallback(() => procurementApi.selection(id), [id]);
  const { data: s, error, reload } = useLoad(fetcher);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true); setProblem('');
    try { await procurementApi.generatePos(id); await reload(); } catch (e) { setProblem(errorText(e)); } finally { setBusy(false); }
  };
  const tone = s?.status === 'approved' || s?.status === 'ordered' ? 'success' : s?.status === 'pending_approval' ? 'warning' : 'neutral';

  return (
    <AppScreen title={s ? s.number : 'Supplier selection'} subtitle={s ? `${s.rfqNumber} · ${s.requisitionNumber}` : ''} onBack={() => (s ? navigation.navigate('RfqDetail', { id: s.rfqId }) : navigation.goBack())} testID="selection-screen"
      right={s ? <StatusChip label={label(s.status)} tone={tone} testID="sel-status" /> : null}>
      <Loading error={error} onRetry={reload} loaded={Boolean(s)} />
      {problem ? <ErrorBanner message={problem} /> : null}
      {s ? (
        <>
          {s.status === 'pending_approval' ? <Text style={styles.warn}>Waiting for approval. Purchase orders can be raised once it is approved.</Text> : null}
          {s.status === 'approved' ? <Button title="Generate purchase orders" onPress={generate} loading={busy} testID="sel-generate" /> : null}
          <Section title={`Allocations · ${formatMoney(s.amount)}`}>
            {s.allocations.map((a) => (
              <Text key={`${a.requisitionLineId}-${a.quoteId}`} style={styles.muted}>S.No {a.serialNo} {a.description}: {formatNumber(a.qty)} {a.unit} from {a.vendorName} ({a.quoteNumber}) @ {formatMoney(a.rate)}, GST {a.taxPercent}% = {formatMoney(a.amount)}{a.lowest ? ' · lowest' : ' · not the lowest'}</Text>
            ))}
          </Section>
          <Section title="Justification"><Text style={styles.muted}>{s.justification}</Text></Section>
          {s.purchaseOrderIds.length ? (
            <Section title="Purchase orders">
              {s.purchaseOrderIds.map((poId, i) => (
                <Pressable key={poId} accessibilityRole="link" onPress={() => navigation.navigate('PurchaseOrderDetail', { id: poId })} testID={`sel-po-${i}`}>
                  <Text style={styles.number}>Open PO {i + 1}</Text>
                </Pressable>
              ))}
            </Section>
          ) : null}
          <History rows={s.history} />
        </>
      ) : null}
    </AppScreen>
  );
}
