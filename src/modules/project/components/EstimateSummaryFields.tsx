import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, parseNumber } from '../../../shared/format';
import { TextField } from '../../../shared/ui/TextField';
import { colors, spacing } from '../../../shared/designSystem';
import { LUMP_CATS, type LumpCat, type LumpSum } from '../../projectFinance/projectFinanceApi';

export type EstimateDraft = { contractValue: string } & Record<LumpCat, string>;
export const emptyEstimate: EstimateDraft = { contractValue: '', material: '', installation: '', subcontract: '', labour: '', transport: '', other: '' };
const LABEL: Record<LumpCat, string> = { material: 'Material', installation: 'Installation', subcontract: 'Subcontractor', labour: 'Labour', transport: 'Transport', other: 'Other' };

// What the create form sends: nothing when the estimate is left empty (it stays optional).
export function estimateBody(d: EstimateDraft): { contractValue?: number; estimateLumpSum?: Partial<LumpSum> } {
  const lump = Object.fromEntries(LUMP_CATS.filter((c) => d[c].trim()).map((c) => [c, parseNumber(d[c]) ?? 0])) as Partial<LumpSum>;
  const contractValue = parseNumber(d.contractValue);
  return { ...(contractValue !== null ? { contractValue } : {}), ...(Object.keys(lump).length ? { estimateLumpSum: lump } : {}) };
}

// Q22: optional estimate summary on project create; refined per BOQ line later on the Estimate screen.
export function EstimateSummaryFields({ value, onChange }: { value: EstimateDraft; onChange: (v: EstimateDraft) => void }) {
  const cost = LUMP_CATS.reduce((s, c) => s + (parseNumber(value[c]) ?? 0), 0);
  const revenue = parseNumber(value.contractValue) ?? 0;
  const profit = revenue - cost;
  return (
    <View style={styles.box} testID="pf-estimate-summary">
      <Text style={styles.title}>Estimate (optional)</Text>
      <Text style={styles.muted}>A first estimate of cost. You can refine it per BOQ line once the BOQ is in.</Text>
      <TextField label="Contract value (₹)" value={value.contractValue} onChangeText={(t) => onChange({ ...value, contractValue: t })} keyboardType="decimal-pad" testID="pf-est-contract" />
      <View style={styles.row}>
        {LUMP_CATS.map((c) => (
          <View key={c} style={styles.cell}><TextField label={`${LABEL[c]} (₹)`} value={value[c]} onChangeText={(t) => onChange({ ...value, [c]: t })} keyboardType="decimal-pad" testID={`pf-est-${c}`} /></View>
        ))}
      </View>
      <Text style={profit < 0 ? styles.bad : styles.text} testID="pf-est-result">
        Total cost {formatMoney(cost)} · revenue {formatMoney(revenue)} · profit {formatMoney(profit)}{revenue ? ` · margin ${Math.round((profit / revenue) * 1000) / 10}%` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text, fontWeight: '600' },
  bad: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 150 },
});
