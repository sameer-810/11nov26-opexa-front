import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import type { StockRow } from '../types';
import { s, useAction } from '../ui';

// Minimum and reorder quantity of one material at this warehouse / site (2F.5). Empty minimum = use the
// company-wide minimum (warehouses); 0 = no low-stock alert here.
export function StockLevelForm({ row, onDone }: { row: StockRow; onDone: () => void }) {
  const [min, setMin] = useState(row.minStock ? String(row.minStock) : '');
  const [reorder, setReorder] = useState(row.reorderQty ? String(row.reorderQty) : '');
  const { busy, problem, run, setProblem } = useAction(onDone);
  const kind = row.location.kind === 'site' ? 'site' : 'warehouse';
  const save = () => {
    const minQty = min.trim() ? parseNumber(min) : null;
    const reorderQty = reorder.trim() ? parseNumber(reorder) : 0;
    if ((min.trim() && (minQty === null || minQty < 0)) || reorderQty === null || reorderQty < 0) return setProblem('Enter quantities of 0 or more');
    return run('level', () => inventoryApi.saveStockLevel({ materialId: row.materialId, location: { kind, id: row.location.id }, minQty, reorderQty }));
  };
  return (
    <View style={s.form} testID={`level-form-${row.code}`}>
      {problem ? <ErrorBanner message={problem} /> : null}
      <Text style={s.muted}>Low-stock alert when available ({formatNumber(row.available)} {row.unit}) falls below the minimum here.</Text>
      <View style={s.row}>
        <View style={s.cell}><TextField label={`Minimum here (${row.unit})`} value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder={kind === 'warehouse' ? 'Company-wide minimum' : 'No alert'} testID={`level-min-${row.code}`} /></View>
        <View style={s.cell}><TextField label="Reorder qty" value={reorder} onChangeText={setReorder} keyboardType="decimal-pad" testID={`level-reorder-${row.code}`} /></View>
      </View>
      <Button title="Save minimum" onPress={() => void save()} loading={busy === 'level'} testID={`level-save-${row.code}`} style={s.self} />
    </View>
  );
}
