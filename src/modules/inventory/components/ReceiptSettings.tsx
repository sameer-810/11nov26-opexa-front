import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { inventoryApi } from '../api/inventoryApi';
import { s, useAction, useData } from '../ui';

// Admin: over-receipt tolerance as % of the PO line (Q15, default 0: any extra needs approval).
export function ReceiptSettings() {
  const fetcher = useCallback(() => inventoryApi.settings(), []);
  const { data, reload } = useData(fetcher);
  const [value, setValue] = useState('');
  const { busy, problem, run, setProblem } = useAction(reload);
  if (!data) return null;
  const save = () => {
    const v = parseNumber(value);
    if (v === null || v < 0 || v > 100) return setProblem('Enter a percentage from 0 to 100');
    void run('save', () => inventoryApi.saveSettings({ overReceiptTolerancePercent: v })).then((ok) => ok && setValue(''));
  };
  return (
    <View style={s.row} testID="receipt-settings">
      <Text style={s.muted}>Over-receipt tolerance: {data.overReceiptTolerancePercent}% of the PO line</Text>
      <TextField label="New tolerance %" value={value} onChangeText={setValue} keyboardType="decimal-pad" testID="tolerance-input" />
      <Button title="Save" variant="outline" onPress={save} loading={busy === 'save'} disabled={!value} testID="tolerance-save" />
      {problem ? <ErrorBanner message={problem} /> : null}
    </View>
  );
}
