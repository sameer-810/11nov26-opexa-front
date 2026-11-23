import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { inventoryApi } from '../api/inventoryApi';
import type { StockRow } from '../types';
import { s, useAction } from '../ui';

type Action = 'mark' | 'write_off' | 'return';
const ACTIONS: { value: Action; label: string }[] = [
  { value: 'mark', label: 'Found damaged in store' },
  { value: 'write_off', label: 'Write off (needs approval)' },
  { value: 'return', label: 'Return to supplier' },
];

// Damaged stock actions on one warehouse row (Q16): good -> damaged, write-off (StockAdjustment), return to supplier.
export function DamagedStockActions({ row, onDone }: { row: StockRow; onDone: () => void }) {
  const [action, setAction] = useState<Action>('mark');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');
  const { busy, problem, run, setProblem } = useAction(onDone);
  const max = action === 'mark' ? row.available : row.damaged ?? 0;

  const save = async () => {
    const q = parseNumber(qty);
    if (!q || q <= 0) return setProblem('Enter the quantity');
    if (q > max) return setProblem(`Only ${formatNumber(max)} ${row.unit} ${action === 'mark' ? 'free' : 'damaged'} here`);
    if (reason.trim().length < 3) return setProblem('Give a reason');
    const body = { warehouseId: row.location.id, materialId: row.materialId, qty: q, reason: reason.trim() };
    const call = action === 'mark' ? () => inventoryApi.markDamaged(body) : action === 'write_off' ? () => inventoryApi.writeOffDamaged(body) : () => inventoryApi.returnDamaged(body);
    if (await run('save', call)) {
      setDone(action === 'write_off' ? 'Write-off sent for approval.' : 'Saved.');
      setQty(''); setReason('');
    }
  };

  return (
    <View style={s.form} testID={`damaged-form-${row.code}`}>
      <ChoiceChips label="Damaged stock" options={(row.damaged ?? 0) > 0 ? ACTIONS : ACTIONS.slice(0, 1)} value={action} onChange={(v) => { setAction(v as Action); setDone(''); }} testID="damaged-action" />
      <Text style={s.muted}>Up to {formatNumber(max)} {row.unit}</Text>
      <TextField label={`Quantity (${row.unit})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" testID="damaged-qty" />
      <TextField label="Reason" value={reason} onChangeText={setReason} testID="damaged-reason" />
      {problem ? <ErrorBanner message={problem} testID="damaged-problem" /> : null}
      {done ? <Text style={s.title} testID="damaged-done">{done}</Text> : null}
      <Button title="Save" onPress={save} loading={busy === 'save'} testID="damaged-save" />
    </View>
  );
}
