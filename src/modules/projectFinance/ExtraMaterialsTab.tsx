import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { saveBlob } from '../../shared/download';
import { formatMoney, formatNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { s, useAction, useData } from '../inventory/ui';
import { projectFinanceApi, type ExtraMaterialReport, type ExtraRequestLine } from './projectFinanceApi';

const BILLABLE = { billable: { label: 'Billable', tone: 'success' }, partly_billable: { label: 'Partly billable', tone: 'warning' }, non_billable: { label: 'Non-billable', tone: 'neutral' } } as const;

type Options = NonNullable<ExtraMaterialReport['extraWorkOptions']>;

// One request line: billed through an extra-work item, or not; the purchaser / PM links or unlinks it.
function RequestLink({ q, options, canLink, busy, onLink }: { q: ExtraRequestLine; options: Options; canLink: boolean; busy: boolean; onLink: (extraWorkItemId: string | null) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <View style={s.row} testID={`extras-req-${q.lineId}`}>
      <Text style={s.muted}>{q.number} · {formatNumber(q.qty)}{q.extraWorkSerialNo ? ` · billed via ${q.extraWorkSerialNo}` : ' · not billed'}</Text>
      {canLink && q.extraWorkItemId ? <Button title="Unlink" variant="ghost" loading={busy} onPress={() => onLink(null)} testID={`extras-unlink-${q.lineId}`} /> : null}
      {canLink && !q.extraWorkItemId && options.length && !picking ? <Button title="Mark billable" variant="outline" onPress={() => setPicking(true)} testID={`extras-mark-${q.lineId}`} /> : null}
      {picking ? <ChoiceChips label="Bill through extra-work item" options={options.map((o) => ({ value: o.id, label: `${o.serialNo}. ${o.description.slice(0, 30)}` }))} value="" onChange={(v) => { setPicking(false); onLink(v); }} testID={`extras-pick-${q.lineId}`} /> : null}
    </View>
  );
}

// Q21: extra (package) material bought against each BOQ line: request -> order -> receipt -> issue -> use, and its cost.
export function ExtraMaterialsTab({ id, canLink }: { id: string; canLink: boolean }) {
  const fetcher = useCallback(() => projectFinanceApi.extraMaterials(id), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const options = data.extraWorkOptions ?? [];
  const link = (q: ExtraRequestLine, extraWorkItemId: string | null) => run(`link-${q.lineId}`, () => projectFinanceApi.linkExtraMaterial(id, { requisitionId: q.requisitionId, lineId: q.lineId, extraWorkItemId }));
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
              {(m.requests ?? []).map((q) => <RequestLink key={q.lineId} q={q} options={options} canLink={canLink} busy={busy === `link-${q.lineId}`} onLink={(x) => void link(q, x)} />)}
            </View>
          ))}
        </View>
      ))}
      {!data.lines.length ? <Text style={s.muted}>No extra material bought against BOQ lines yet.</Text> : null}
    </View>
  );
}
