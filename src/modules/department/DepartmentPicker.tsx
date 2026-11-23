import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { colors } from '../../shared/designSystem';
import { departmentApi, type Department } from './departmentApi';

type Props = { label?: string; value: string | null; onChange: (id: string | null) => void; testID?: string };

// Choose one department from the company's list, or none.
export function DepartmentPicker({ label = 'Department', value, onChange, testID = 'department' }: Props) {
  const [items, setItems] = useState<Department[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    departmentApi.list().then((d) => live && setItems(d)).catch(() => live && setError('Could not load departments'));
    return () => { live = false; };
  }, []);
  if (error) return <Text style={{ color: colors.danger }}>{error}</Text>;
  if (!items) return null;
  if (!items.length) return <Text style={{ color: colors.textMuted }}>No departments yet. Add them under Approvals → Settings.</Text>;
  return (
    <ChoiceChips
      label={label}
      testID={testID}
      value={value ?? 'none'}
      onChange={(v) => onChange(v === 'none' ? null : v)}
      options={[{ value: 'none', label: 'None' }, ...items.map((d) => ({ value: d.id, label: d.name, hint: d.code }))]}
    />
  );
}
