import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../shared/format';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { inventoryApi } from '../api/inventoryApi';
import { s, useData } from '../ui';

const VIEWS = [{ value: '', label: 'All locations' }, { value: 'warehouse', label: 'Warehouses' }, { value: 'site', label: 'Sites' }, { value: 'transit', label: 'In transit' }, { value: 'low', label: 'Low stock' }];

// Stock by warehouse / site / in transit, with reserved and available quantity and value.
export function StockTab() {
  const [view, setView] = useState('');
  const fetcher = useCallback(async () => {
    const [rows, val, rec] = await Promise.all([inventoryApi.stock(view === 'low' ? { low: 'true' } : { kind: view || undefined }), inventoryApi.valuation(), inventoryApi.reconciliation().catch(() => null)]);
    return { rows, val, rec };
  }, [view]);
  const { data, error, reload } = useData(fetcher);
  return (
    <View style={s.list} testID="stock-tab">
      <ChoiceChips label="Show" options={VIEWS} value={view} onChange={setView} testID="stock-view" />
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={s.row}>
            <Text style={s.title} testID="stock-total">Stock value {formatMoney(data.val.total)}</Text>
            {data.rec ? <StatusChip label={data.rec.ok ? 'Ledger reconciled' : `${data.rec.mismatches.length} ledger mismatch(es)`} tone={data.rec.ok ? 'success' : 'danger'} /> : null}
          </View>
          {data.rows.length === 0 ? <Text style={s.muted}>Nothing in stock here.</Text> : null}
          {data.rows.map((r) => (
            <View key={`${r.materialId}-${r.location.kind}-${r.location.id}`} style={s.card} testID={`stock-${r.code}-${r.location.kind}`}>
              <View style={s.row}><Text style={s.title}>{r.name}</Text>{r.low ? <StatusChip label={`Below minimum ${formatNumber(r.minStock)}`} tone="danger" /> : null}</View>
              <Text style={s.muted}>{r.location.name} · on hand {formatNumber(r.onHand)} {r.unit}{r.reserved ? ` · reserved ${formatNumber(r.reserved)} · available ${formatNumber(r.available)}` : ''} · {formatMoney(r.value)} (avg {formatMoney(r.avgRate)})</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}
