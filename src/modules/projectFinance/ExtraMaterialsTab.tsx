import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { saveBlob } from '../../shared/download';
import { formatMoney, formatNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { s, useAction, useData } from '../inventory/ui';
import { projectFinanceApi } from './projectFinanceApi';

const BILLABLE = { billable: { label: 'Billable', tone: 'success' }, partly_billable: { label: 'Partly billable', tone: 'warning' }, non_billable: { label: 'Non-billable', tone: 'neutral' } } as const;

// Q21: extra (package) material bought against each BOQ line: request -> order -> receipt -> issue -> use, and its cost.
export function ExtraMaterialsTab({ id }: { id: string }) {
  const fetcher = useCallback(() => projectFinanceApi.extraMaterials(id), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => undefined);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const excel = () => run('xlsx', async () => { if (!saveBlob(await projectFinanceApi.extraMaterialsExcel(id), 'extra-materials.xlsx')) setProblem('Open this on the web to download the Excel file.'); });
  return (
    <View style={s.list} testID="pf-extras">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.row}>
        <Text style={[s.title, s.cell]} testID="extras-total">Extra material cost {formatMoney(data.totals.cost)} · billable {formatMoney(data.totals.billableCost)} · non-billable {formatMoney(data.totals.nonBillableCost)}</Text>
        <Button title="Excel" variant="outline" onPress={() => void excel()} loading={busy === 'xlsx'} testID="extras-excel" />
      </View>
      <Text style={s.muted}>Extra material is not billed to the client unless it is linked to an approved extra-work item. Its cost stays on the BOQ line it was bought for.</Text>
      {data.lines.map((l) => (
        <View key={l.workOrderItemId} style={s.card} testID={`extras-line-${l.serialNo}`}>
          <Text style={s.title}>S.No {l.serialNo} {l.description} · {formatMoney(l.cost)}</Text>
          {l.materials.map((m) => (
            <View key={m.materialId} style={s.row}>
              <Text style={[s.muted, s.cell]}>
                {m.name}: requested {formatNumber(m.requested)} · ordered {formatNumber(m.ordered)} · received {formatNumber(m.received)} · with subcontractor {formatNumber(m.issuedToSubcontractor)} · used {formatNumber(m.consumed)} {m.unit} · cost {formatMoney(m.cost)}
                {m.extraWork.length ? ` · billed via ${m.extraWork.join(', ')}` : ''}
              </Text>
              <StatusChip label={BILLABLE[m.billable].label} tone={BILLABLE[m.billable].tone} />
            </View>
          ))}
        </View>
      ))}
      {!data.lines.length ? <Text style={s.muted}>No extra material bought against BOQ lines yet.</Text> : null}
    </View>
  );
}
