import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { StatusChip } from '../../shared/ui/StatusChip';
import { ErrorBanner } from '../../shared/ui/Banner';
import { s, useAction, useData } from '../inventory/ui';
import { stockPlanApi, type StockPlanLine } from './stockPlanApi';

type Props = { requisitionId: string; onChanged?: () => void };

const breakdown = (l: StockPlanLine) => (l.warehouses.length ? l.warehouses.map((w) => `${w.name} ${formatNumber(w.available)}`).join(', ') : 'none');

// Requested / available per warehouse / to issue / to purchase per request line, with the purchaser's
// "Reserve & issue plan", "Create transfer" and release actions (Q13). Other sites' stock is for information only.
export function StockAvailabilityPanel({ requisitionId, onChanged }: Props) {
  const fetcher = useCallback(() => stockPlanApi.get(requisitionId), [requisitionId]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => { void reload(); onChanged?.(); });
  const [releasing, setReleasing] = useState('');
  const [reason, setReason] = useState('');

  // Supplementary: when it cannot load (e.g. no access to the store), the request screen simply goes without it.
  if (error || !data?.lines) return null;
  const release = async () => {
    if (reason.trim().length < 3) return;
    if (await run('release', () => stockPlanApi.release(releasing, reason.trim()))) { setReleasing(''); setReason(''); }
  };

  return (
    <View style={s.list} testID="stock-plan">
      <Text style={s.title}>Stock availability</Text>
      {data.lines.map((l) => (
        <View key={l.requisitionLineId} style={s.card} testID={`stock-plan-line-${l.serialNo}`}>
          <Text style={s.title}>{l.serialNo}. {l.description}</Text>
          {!l.stockLink ? <StatusChip label="No stock link" tone="neutral" testID={`stock-plan-nolink-${l.serialNo}`} /> : null}
          <View style={s.row}>
            <Text style={s.muted}>Requested {formatNumber(l.requested)} {l.unit}</Text>
            {l.fromStock ? <Text style={s.muted}>· from stock {formatNumber(l.fromStock)}</Text> : null}
            {l.ordered ? <Text style={s.muted}>· ordered {formatNumber(l.ordered)}</Text> : null}
          </View>
          {l.stockLink ? <Text style={s.muted} testID={`stock-plan-available-${l.serialNo}`}>Available {formatNumber(l.available)}: {breakdown(l)}</Text> : null}
          <View style={s.row}>
            <Text style={s.number} testID={`stock-plan-issue-${l.serialNo}`}>To issue {formatNumber(l.toIssue)}</Text>
            <Text style={s.number} testID={`stock-plan-buy-${l.serialNo}`}>To purchase {formatNumber(l.toPurchase)}</Text>
          </View>
          {l.otherSites.length ? <Text style={s.muted}>Other sites (information only): {l.otherSites.map((o) => `${o.name} ${formatNumber(o.qty)}`).join(', ')}</Text> : null}
          {l.reservations.map((r) => (
            <View key={r.id} style={s.row} testID={`reservation-${r.id}`}>
              <Text style={r.status === 'released' ? s.muted : s.warn}>
                {r.status === 'active' ? 'Reserved' : r.status === 'transferred' ? `Transfer ${r.transferNumber ?? ''}` : 'Released'} {formatNumber(r.qty)} at {r.warehouseName}{r.releaseReason ? ` · ${r.releaseReason}` : ''}
              </Text>
              {data.canPlan && r.status === 'active' ? <Button title="Release" variant="ghost" onPress={() => { setReleasing(r.id); setReason(''); }} testID={`release-${r.id}`} /> : null}
            </View>
          ))}
        </View>
      ))}
      {releasing ? (
        <View style={s.form}>
          <TextField label="Why release this stock?" value={reason} onChangeText={setReason} testID="release-reason" />
          <View style={s.row}>
            <Button title="Release" onPress={release} loading={busy === 'release'} disabled={reason.trim().length < 3} testID="release-confirm" />
            <Button title="Keep it" variant="ghost" onPress={() => setReleasing('')} />
          </View>
        </View>
      ) : null}
      {problem ? <ErrorBanner message={problem} testID="stock-plan-problem" /> : null}
      {data.canPlan ? (
        <View style={s.row}>
          {data.totals.toIssue > 0 ? <Button title={`Reserve & issue plan (${formatNumber(data.totals.toIssue)})`} onPress={() => run('reserve', () => stockPlanApi.reserve(requisitionId))} loading={busy === 'reserve'} testID="stock-plan-reserve" /> : null}
          {data.totals.activeReservations > 0 ? <Button title="Create transfer" variant="outline" onPress={() => run('transfer', () => stockPlanApi.transfer(requisitionId))} loading={busy === 'transfer'} testID="stock-plan-transfer" /> : null}
        </View>
      ) : null}
    </View>
  );
}
