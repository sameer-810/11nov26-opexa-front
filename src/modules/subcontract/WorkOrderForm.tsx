import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { parseNumber } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { TextField } from '../../shared/ui/TextField';
import { projectApi } from '../project/api/projectApi';
import type { BoqItem } from '../project/types';
import { s } from '../inventory/ui';
import { subcontractApi, type Agreement } from './subcontractApi';

// Work order under an agreement: pick BOQ lines of that project and enter the agreed quantity and rate.
export function WorkOrderForm({ agreements, onSave, busy }: { agreements: Agreement[]; onSave: (fn: () => Promise<unknown>) => void; busy: boolean }) {
  const [agreementId, setAgreementId] = useState('');
  const [boq, setBoq] = useState<BoqItem[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const agreement = agreements.find((a) => a.id === agreementId);
  useEffect(() => { if (agreement) projectApi.boq(agreement.projectId).then(setBoq).catch(() => setBoq([])); }, [agreement]);
  const set = (k: string) => (v: string) => setVals((x) => ({ ...x, [k]: v }));
  const save = () => onSave(async () => {
    const lines = boq.map((i) => ({ workOrderItemId: i.id, qty: parseNumber(vals[`q-${i.id}`] ?? '') ?? 0, rate: parseNumber(vals[`r-${i.id}`] ?? '') ?? 0 })).filter((l) => l.qty > 0);
    await subcontractApi.createWorkOrder({ agreementId, lines });
    setVals({});
  });
  return (
    <View style={s.form} testID="wo-form">
      <Text style={s.title}>New work order</Text>
      <ChoiceChips label="Agreement" options={agreements.filter((a) => a.status === 'active').map((a) => ({ value: a.id, label: `${a.number} ${a.title}` }))} value={agreementId} onChange={setAgreementId} testID="wo-agreement" />
      {boq.map((i) => (
        <View key={i.id} style={s.row}>
          <Text style={[s.muted, s.cell]}>S.No {i.serialNo} {i.description} ({i.quantity} {i.unit})</Text>
          <TextField label="Qty" value={vals[`q-${i.id}`] ?? ''} onChangeText={set(`q-${i.id}`)} keyboardType="decimal-pad" testID={`wo-qty-${i.serialNo}`} />
          <TextField label="Rate ₹" value={vals[`r-${i.id}`] ?? ''} onChangeText={set(`r-${i.id}`)} keyboardType="decimal-pad" testID={`wo-rate-${i.serialNo}`} />
        </View>
      ))}
      {agreementId ? <Button title="Create work order" onPress={save} loading={busy} testID="wo-create" /> : null}
    </View>
  );
}
