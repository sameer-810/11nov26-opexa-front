import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { saveBlob } from '../../shared/download';
import { formatMoney } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { s, useAction, useData } from '../inventory/ui';
import { projectFinanceApi } from './projectFinanceApi';

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);

// 3F: per BOQ line estimated vs actual cost (material incl. extras, certified subcontract, shared costs) vs billed.
export function BoqProfitTab({ id }: { id: string }) {
  const fetcher = useCallback(() => projectFinanceApi.boqProfitability(id), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => undefined);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.totals;
  const excel = () => run('xlsx', async () => { if (!saveBlob(await projectFinanceApi.boqProfitabilityExcel(id), 'boq-profitability.xlsx')) setProblem('Open this on the web to download the Excel file.'); });
  return (
    <View style={s.list} testID="pf-lines">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={s.row}>
        <Text style={[s.title, s.cell]} testID="profit-total">BOQ {formatMoney(t.revenue)} · estimated {formatMoney(t.estimatedCost)} · actual {formatMoney(t.actualCost)} · billed {formatMoney(t.billed)} · forecast margin {formatMoney(t.forecastMargin)} ({pct(t.forecastMarginPct)})</Text>
        <Button title="Excel" variant="outline" onPress={() => void excel()} loading={busy === 'xlsx'} testID="profit-excel" />
      </View>
      {t.overrunLines ? <ErrorBanner message={`${t.overrunLines} BOQ line(s) have cost above the estimate.`} /> : null}
      {data.lines.map((l) => (
        <View key={l.workOrderItemId} style={s.card} testID={`profit-line-${l.serialNo}`}>
          <Text style={s.title}>S.No {l.serialNo} {l.description}{l.tendered ? '' : ' · additional work'}</Text>
          <Text style={s.muted}>BOQ {formatMoney(l.revenue)} · estimated cost {formatMoney(l.estimatedCost)} · billed {formatMoney(l.billed)}</Text>
          <Text style={l.overrun ? s.danger : s.muted} testID={`profit-actual-${l.serialNo}`}>
            Actual {formatMoney(l.actualCost)} = material {formatMoney(l.actual.material)}{l.actual.extraMaterial ? ` (extra ${formatMoney(l.actual.extraMaterial)})` : ''} + subcontract {formatMoney(l.actual.subcontract)} + shared {formatMoney(l.actual.allocated)}
            {l.overrun ? ` · over estimate by ${formatMoney(l.overrunBy)}` : ''}
          </Text>
          <Text style={l.forecastMargin < 0 ? s.danger : s.muted}>Forecast margin {formatMoney(l.forecastMargin)} ({pct(l.forecastMarginPct)})</Text>
        </View>
      ))}
      <Text style={s.muted}>{data.rule}</Text>
    </View>
  );
}
