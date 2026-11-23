import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { api, apiBlob } from '../../../shared/api/apiClient';
import { saveBlob } from '../../../shared/download';
import { colors } from '../../../shared/designSystem';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { s, useAction, useData } from '../../inventory/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectQuantities'>;
export const QTY_FIELDS = ['requested', 'approved', 'ordered', 'received', 'supplierInvoiced', 'issued', 'consumed', 'returned', 'executed', 'billed'] as const;
type QtyField = (typeof QTY_FIELDS)[number];
export type QuantityLine = { key: string; workOrderItemId: string | null; materialId: string | null; boq: boolean; serialNo: string; description: string; unit: string; boqQty: number | null }
  & Record<Exclude<QtyField, 'executed' | 'billed'>, number> & Record<'executed' | 'billed', number | null>;
export type QuantityView = { projectId: string; code: string; name: string; lines: QuantityLine[] };

const LABEL: Record<QtyField, string> = { requested: 'Requested', approved: 'Approved', ordered: 'Ordered', received: 'Received', supplierInvoiced: 'Supplier inv.', issued: 'Issued (sub)', consumed: 'Consumed / installed', returned: 'Returned', executed: 'Executed', billed: 'Billed' };
const num = (n: number | null) => (n === null ? '—' : String(n));

// X1: every quantity of a BOQ line side by side (table on wide screens, a card per line on phones).
export function QuantityViewScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const wide = useWindowDimensions().width >= 900;
  const fetcher = useCallback(() => api<QuantityView>(`/projects/${id}/quantities`), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => undefined);
  const back = () => navigation.navigate('ProjectDetail', { id });
  if (error) return <AppScreen title="Quantities" onBack={back}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const excel = () => run('x', async () => { saveBlob(await apiBlob(`/projects/${id}/quantities/excel`), `${data?.code ?? 'project'}-quantities.xlsx`); });
  const title = (l: QuantityLine) => `${l.boq ? l.serialNo : 'Non-BOQ'} · ${l.description}${l.unit ? ` (${l.unit})` : ''}`;

  return (
    <AppScreen title="Quantities" subtitle="Requested to billed, per BOQ line" onBack={back} testID="quantities-screen">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.row}><Button title="Download Excel" variant="outline" onPress={excel} loading={busy === 'x'} testID="qty-excel" /></View>
      {data && data.lines.length === 0 ? <Text style={s.muted}>No BOQ lines yet.</Text> : null}
      {data && wide ? (
        <ScrollView horizontal testID="qty-table">
          <View>
            <View style={[st.tr, st.head]}>
              <Text style={[st.th, st.desc]}>Item</Text>
              <Text style={st.th}>BOQ</Text>
              {QTY_FIELDS.map((f) => <Text key={f} style={st.th}>{LABEL[f]}</Text>)}
            </View>
            {data.lines.map((l) => (
              <View key={l.key} style={st.tr} testID={`qty-row-${l.key}`}>
                <Text style={[st.td, st.desc]} numberOfLines={2}>{title(l)}</Text>
                <Text style={st.td}>{num(l.boqQty)}</Text>
                {QTY_FIELDS.map((f) => <Text key={f} style={st.td} testID={`qty-${l.key}-${f}`}>{num(l[f])}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {data && !wide ? data.lines.map((l) => (
        <View key={l.key} style={s.card} testID={`qty-card-${l.key}`}>
          <Text style={s.title}>{title(l)}</Text>
          {l.boqQty !== null ? <Text style={s.muted}>BOQ {l.boqQty}</Text> : null}
          <View style={st.grid}>
            {QTY_FIELDS.map((f) => (
              <View key={f} style={st.cell}><Text style={s.muted}>{LABEL[f]}</Text><Text style={st.val} testID={`qty-${l.key}-${f}`}>{num(l[f])}</Text></View>
            ))}
          </View>
        </View>
      )) : null}
    </AppScreen>
  );
}

const st = StyleSheet.create({
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6 },
  head: { backgroundColor: '#F8FAFF' },
  th: { width: 92, fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'right', paddingHorizontal: 4 },
  td: { width: 92, fontSize: 13, color: colors.text, textAlign: 'right', paddingHorizontal: 4 },
  desc: { width: 260, textAlign: 'left' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 2 },
  val: { fontSize: 15, fontWeight: '700', color: colors.text },
});
