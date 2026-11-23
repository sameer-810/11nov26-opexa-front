import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { parseNumber } from '../../../shared/format';
import { DepartmentPicker } from '../../department/DepartmentPicker';
import { TRANSACTION_TYPES, type Person, type TransactionType, type Workflow, type WorkflowInput } from '../api/approvalApi';
import { roleName } from './ApprovalHistory';

// Roles that can be an approval level (anyone in the role can act, or their delegate).
export const APPROVER_ROLES = ['purchaser', 'project_manager', 'hod', 'director', 'accounts', 'admin', 'store_incharge', 'service_head', 'hr'] as const;
export const typeLabel = (t: string) => ({ requisition: 'Material request', purchase_order: 'Purchase order', po_revision: 'PO revision', supplier_selection: 'Supplier selection', boq_revision: 'BOQ revision', additional_work: 'Additional work', work_order: 'Subcontract work order', work_certificate: 'Work certificate', transfer: 'Stock transfer', billing: 'Billing', expense: 'Expense voucher', over_receipt: 'Over-receipt', supplier_payment: 'Supplier payment', retention_release: 'Retention release', early_billing: 'Early billing (payment term)' }[t] ?? t);

type LevelDraft = { by: 'role' | 'user'; value: string };
type Props = { workflow: Workflow | null; people: Person[]; projects: { id: string; code: string; name: string }[]; onSave: (input: WorkflowInput) => Promise<void>; onCancel: () => void };

const toDraft = (w: Workflow | null): LevelDraft[] => (w?.levels.length ? w.levels.map((l) => (l.approverUserId ? { by: 'user', value: l.approverUserId } : { by: 'role', value: l.approverRole ?? '' })) : [{ by: 'role', value: 'project_manager' }]);

// Create or edit one approval workflow: what it covers (type, project, department, amount band) and its ordered levels.
export function WorkflowForm({ workflow, people, projects, onSave, onCancel }: Props) {
  const locked = Boolean(workflow?.isDefault);
  const [name, setName] = useState(workflow?.name ?? '');
  const [type, setType] = useState<TransactionType>(workflow?.transactionType ?? 'requisition');
  const [projectId, setProjectId] = useState(workflow?.projectId ?? 'any');
  const [departmentId, setDepartmentId] = useState<string | null>(workflow?.departmentId ?? null);
  const [min, setMin] = useState(workflow ? String(workflow.minAmount) : '0');
  const [max, setMax] = useState(workflow?.maxAmount != null ? String(workflow.maxAmount) : '');
  const [levels, setLevels] = useState<LevelDraft[]>(toDraft(workflow));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setLevel = (i: number, l: LevelDraft) => setLevels((x) => x.map((y, n) => (n === i ? l : y)));
  const save = async () => {
    const minAmount = parseNumber(min);
    const maxAmount = max.trim() ? parseNumber(max) : null;
    if (name.trim().length < 3) return setError('Give the workflow a name (3 letters or more)');
    if (minAmount === null || minAmount < 0 || (max.trim() && (maxAmount === null || maxAmount < minAmount))) return setError('Check the amounts: maximum must be empty or at least the minimum');
    if (levels.some((l) => !l.value)) return setError('Choose a role or a person for every level');
    setError(''); setBusy(true);
    try {
      await onSave({
        name: name.trim(), transactionType: type, projectId: projectId === 'any' ? null : projectId, departmentId, minAmount, maxAmount, isActive: workflow?.isActive ?? true,
        levels: levels.map((l, i) => (l.by === 'role' ? { sequence: i + 1, approverRole: l.value } : { sequence: i + 1, approverUserId: l.value })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.card} testID="workflow-form">
      <TextField label="Name" value={name} onChangeText={setName} maxLength={120} testID="wf-name" />
      {locked ? <Text style={styles.muted}>Default chain: used for every {workflow?.transactionType === 'expense' ? `${workflow.defaultKey === 'expense_office' ? 'office' : 'project'} expense voucher` : workflow?.transactionType === 'supplier_payment' ? 'supplier payment' : 'material request'} no other workflow matches. You can change its levels{workflow?.defaultKey === 'high' || workflow?.defaultKey === 'payment_high' ? ' and the amount it starts at' : ''}.</Text> : (
        <>
          <ChoiceChips label="Applies to" value={type} onChange={(v) => setType(v as TransactionType)} options={TRANSACTION_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} testID="wf-type" />
          <ChoiceChips label="Project" value={projectId} onChange={setProjectId} options={[{ value: 'any', label: 'Any project' }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]} testID="wf-project" />
          <DepartmentPicker label="Department" value={departmentId} onChange={setDepartmentId} testID="wf-department" />
        </>
      )}
      {!workflow?.defaultKey || workflow.defaultKey === 'high' || workflow.defaultKey === 'payment_high' ? (
        <View style={styles.row}>
          <TextField label="From amount (₹)" value={min} onChangeText={setMin} keyboardType="decimal-pad" style={styles.flex} testID="wf-min" />
          {locked ? null : <TextField label="Up to amount (₹, optional)" value={max} onChangeText={setMax} keyboardType="decimal-pad" style={styles.flex} testID="wf-max" />}
        </View>
      ) : null}
      <Text style={styles.section}>Levels, in order</Text>
      {levels.map((l, i) => (
        <View key={i} style={styles.level} testID={`wf-level-${i + 1}`}>
          <ChoiceChips label={`Level ${i + 1}`} value={l.by} onChange={(v) => setLevel(i, { by: v as LevelDraft['by'], value: '' })} options={[{ value: 'role', label: 'By role' }, { value: 'user', label: 'A person' }]} testID={`wf-level-${i + 1}-by`} />
          {l.by === 'role'
            ? <ChoiceChips label="Role" value={l.value} onChange={(v) => setLevel(i, { by: 'role', value: v })} options={APPROVER_ROLES.map((r) => ({ value: r, label: roleName(r) }))} testID={`wf-level-${i + 1}-role`} />
            : <ChoiceChips label="Person" value={l.value} onChange={(v) => setLevel(i, { by: 'user', value: v })} options={people.filter((p) => p.canApprove || p.role === 'purchaser').map((p) => ({ value: p.id, label: p.name, hint: roleName(p.role) }))} testID={`wf-level-${i + 1}-user`} />}
        </View>
      ))}
      <View style={styles.row}>
        <Button title="Add level" variant="outline" onPress={() => setLevels((x) => [...x, { by: 'role', value: '' }])} testID="wf-add-level" />
        {levels.length > 1 ? <Button title="Remove last level" variant="ghost" onPress={() => setLevels((x) => x.slice(0, -1))} testID="wf-remove-level" /> : null}
      </View>
      {error ? <ErrorBanner message={error} testID="wf-error" /> : null}
      <View style={styles.row}>
        <Button title="Save workflow" onPress={save} loading={busy} testID="wf-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  level: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-end' },
  flex: { flexGrow: 1, flexBasis: 160 },
  section: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
});
