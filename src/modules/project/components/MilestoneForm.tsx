import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { s as ui } from '../../inventory/ui';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { spacing } from '../../../shared/designSystem';
import type { AssignableUser, Milestone, MilestoneInput } from '../types';

type Props = {
  initial?: Milestone;
  people: AssignableUser[];
  onSave: (input: MilestoneInput) => Promise<void>;
  onRemove?: () => Promise<void>;
  onCancel: () => void;
};
type Errors = Partial<Record<'name' | 'plannedDate' | 'actualDate', string>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NOBODY = '';

export function validateMilestone(f: { name: string; plannedDate: string; actualDate: string }): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Enter a name';
  if (!DAY.test(f.plannedDate.trim())) e.plannedDate = 'Use YYYY-MM-DD';
  if (f.actualDate.trim() && !DAY.test(f.actualDate.trim())) e.actualDate = 'Use YYYY-MM-DD, or leave empty';
  return e;
}

// Add or change one schedule milestone. "Actual date" marks it done.
export function MilestoneForm({ initial, people, onSave, onRemove, onCancel }: Props) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    plannedDate: initial?.plannedDate ?? '',
    actualDate: initial?.actualDate ?? '',
    ownerId: initial?.ownerId ?? NOBODY,
    started: initial?.startedAt ? 'yes' : 'no',
    remarks: initial?.remarks ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setProblem('');
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy('');
    }
  };
  const save = () => {
    const found = validateMilestone(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    void run('save', () => onSave({
      name: f.name.trim(), plannedDate: f.plannedDate.trim(), actualDate: f.actualDate.trim() || null,
      ownerId: f.ownerId || null, started: f.started === 'yes', remarks: f.remarks.trim(),
    }));
  };

  return (
    <View style={ui.form} testID="ms-form">
      {problem ? <ErrorBanner message={problem} testID="ms-problem" /> : null}
      <TextField label="Milestone" value={f.name} onChangeText={set('name')} error={errors.name} placeholder="e.g. Ducting complete" testID="ms-name" />
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Planned date (YYYY-MM-DD)" value={f.plannedDate} onChangeText={set('plannedDate')} error={errors.plannedDate} testID="ms-planned" /></View>
        <View style={styles.cell}><TextField label="Actual date (when done)" value={f.actualDate} onChangeText={set('actualDate')} error={errors.actualDate} testID="ms-actual" /></View>
      </View>
      <ChoiceChips label="Work started?" value={f.started} onChange={set('started')} options={[{ value: 'no', label: 'Not yet' }, { value: 'yes', label: 'Started' }]} testID="ms-started" />
      <ChoiceChips label="Owner" value={f.ownerId} onChange={set('ownerId')} options={[{ value: NOBODY, label: 'Nobody' }, ...people.map((p) => ({ value: p.id, label: p.name }))]} testID="ms-owner" />
      <TextField label="Remarks" value={f.remarks} onChangeText={set('remarks')} multiline testID="ms-remarks" />
      <View style={styles.row}>
        <Button title="Save" onPress={save} loading={busy === 'save'} testID="ms-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} testID="ms-cancel" />
        {onRemove ? <Button title="Remove" variant="outline" onPress={() => void run('remove', onRemove)} loading={busy === 'remove'} testID="ms-remove" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' },
  cell: { flexGrow: 1, flexBasis: 200 },
});
