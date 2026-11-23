import { Text, View } from 'react-native';
import { formatNumber } from '../../../shared/format';
import { s } from '../../inventory/ui';
import type { LowSide } from '../billingApi';

// One BOQ line's quantity ladder: original BOQ -> variation -> execution -> measured -> client-verified -> approved -> billed.
export function ladderSteps(l: LowSide): { key: string; label: string; qty: number | null }[] {
  return [
    { key: 'boq', label: 'BOQ', qty: l.boqQty },
    { key: 'variation', label: 'Variation', qty: l.variationQty },
    { key: 'executed', label: 'Execution', qty: l.executedQty },
    { key: 'measured', label: 'Measured', qty: l.measuredQty },
    { key: 'verified', label: 'Client-verified', qty: l.clientVerifiedQty },
    { key: 'approved', label: 'Approved', qty: l.approvedQty },
    { key: 'billed', label: 'Billed', qty: l.billedQty },
  ];
}

export function QuantityLadder({ line }: { line: LowSide }) {
  return (
    <View style={s.card} testID={`ladder-${line.serialNo}`} accessibilityLabel={`Quantities for S.No ${line.serialNo}`}>
      <Text style={s.title}>S.No {line.serialNo} {line.description} ({line.unit})</Text>
      <View style={s.row}>
        {ladderSteps(line).map((step, i) => (
          <Text key={step.key} style={s.muted} testID={`ladder-${line.serialNo}-${step.key}`}>
            {i ? '→ ' : ''}{step.label} {step.qty == null ? '—' : formatNumber(step.qty)}
          </Text>
        ))}
      </View>
      <Text style={s.muted}>Billing allowed up to {formatNumber(line.allowedQty)} {line.unit}</Text>
      {line.overBoq ? (
        <Text style={s.warn} testID={`ladder-${line.serialNo}-over`}>
          Approved {formatNumber(line.overBoqQty)} {line.unit} beyond the allowed quantity. {line.overBoqHint ?? ''}
        </Text>
      ) : null}
    </View>
  );
}
