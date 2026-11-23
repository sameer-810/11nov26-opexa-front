import { useState } from 'react';
import { View } from 'react-native';
import { parseNumber, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import type { Party, Tool } from '../types';
import { s } from '../ui';

export type ToolMode = 'issue' | 'return' | 'repair' | 'repaired' | 'service' | 'missing' | 'damaged';
type Run = (key: string, fn: () => Promise<unknown>) => Promise<boolean>;
type Props = { tool: Tool; mode: ToolMode; projects: { value: string; label: string }[]; busy: string; run: Run; setProblem: (m: string) => void; onClose: () => void };

const PARTY = [{ value: 'employee', label: 'Employee' }, { value: 'subcontractor', label: 'Subcontractor' }, { value: 'other', label: 'Other' }];
const AT_ISSUE = [{ value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'needs_repair', label: 'Needs repair' }];
const AT_RETURN = [...AT_ISSUE, { value: 'damaged', label: 'Damaged' }];
const SERVICE = [{ value: 'service', label: 'Service' }, { value: 'calibration', label: 'Calibration' }, { value: 'repair', label: 'Repair (done in place)' }];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const optDate = (v: string) => (v.trim() ? v.trim() : undefined);

// The form for one tool action: issue, return, send for repair, repaired, service record, lost or damaged.
export function ToolActionForm({ tool, mode, projects, busy, run, setProblem, onClose }: Props) {
  const [kind, setKind] = useState<Party['kind']>('employee');
  const [name, setName] = useState('');
  const [condition, setCondition] = useState<string>(mode === 'issue' && ['good', 'fair', 'needs_repair'].includes(tool.condition) ? tool.condition : 'good');
  const [projectId, setProjectId] = useState(tool.holder?.projectId ?? '');
  const [date, setDate] = useState(todayLocal());
  const [due, setDue] = useState('');
  const [text, setText] = useState('');
  const [vendor, setVendor] = useState('');
  const [money, setMoney] = useState('');
  const [type, setType] = useState<'service' | 'calibration' | 'repair'>('service');
  const key = `${mode}-${tool.id}`;
  const done = (fn: () => Promise<unknown>) => run(key, fn).then((ok) => { if (ok) onClose(); });
  const amount = (): number | undefined | null => (money.trim() ? parseNumber(money) : undefined);

  const save = () => {
    if (!isDate(date) || (due && !isDate(due))) return setProblem('Enter dates as YYYY-MM-DD');
    const value = amount();
    if (value === null || (value !== undefined && value < 0)) return setProblem('Enter the amount in rupees');
    const project = projectId || undefined;
    if (mode === 'issue') {
      if (name.trim().length < 2) return setProblem('Enter who the tool is issued to');
      return done(() => inventoryApi.issueTool(tool.id, { holder: { kind, name: name.trim() }, projectId: project, expectedReturn: optDate(due), condition: condition as 'good' | 'fair' | 'needs_repair' }));
    }
    if (mode === 'return') return done(() => inventoryApi.returnTool(tool.id, condition as 'good' | 'fair' | 'needs_repair' | 'damaged', { returnedAt: date, remarks: text.trim() || undefined }));
    if (mode === 'repair') return done(() => inventoryApi.sendForRepair(tool.id, { vendor: vendor.trim() || undefined, notes: text.trim() || undefined, date, projectId: project }));
    if (mode === 'repaired') return done(() => inventoryApi.markRepaired(tool.id, { cost: value, vendor: vendor.trim() || undefined, notes: text.trim() || undefined, date, nextDueDate: optDate(due), projectId: project }));
    if (mode === 'service') return done(() => inventoryApi.addMaintenance(tool.id, { type, cost: value, vendor: vendor.trim() || undefined, notes: text.trim() || undefined, date, nextDueDate: optDate(due), projectId: project }));
    if (text.trim().length < 3) return setProblem('Say what happened');
    const responsible = name.trim() ? { kind, name: name.trim() } : undefined;
    return done(() => inventoryApi.toolStatus(tool.id, mode, text.trim(), { responsible, recoveryAmount: value }));
  };

  const withProject = ['issue', 'repair', 'repaired', 'service'].includes(mode);
  const withCost = ['repaired', 'service', 'missing', 'damaged'].includes(mode);
  return (
    <View style={s.form} testID={`tool-form-${mode}`}>
      {mode === 'service' ? <ChoiceChips label="Record" options={SERVICE} value={type} onChange={(v) => setType(v as typeof type)} /> : null}
      {['issue', 'missing', 'damaged'].includes(mode) ? <ChoiceChips label={mode === 'issue' ? 'Issue to' : 'Responsible (optional)'} options={PARTY} value={kind} onChange={(v) => setKind(v as Party['kind'])} /> : null}
      {['issue', 'missing', 'damaged'].includes(mode) ? <TextField label="Name" value={name} onChangeText={setName} placeholder={mode === 'issue' ? '' : tool.holder?.name ?? ''} testID={mode === 'issue' ? 'tool-holder' : 'tool-responsible'} /> : null}
      {mode === 'issue' || mode === 'return' ? <ChoiceChips label={mode === 'issue' ? 'Condition at issue' : 'Condition at return'} options={mode === 'issue' ? AT_ISSUE : AT_RETURN} value={condition} onChange={setCondition} testID="tool-condition" /> : null}
      {withProject && projects.length ? <ChoiceChips label="Project (cost goes to the project; none = office)" options={[{ value: '', label: 'None' }, ...projects]} value={projectId} onChange={setProjectId} testID="tool-project" /> : null}
      <View style={s.row}>
        {mode !== 'issue' && mode !== 'missing' && mode !== 'damaged' ? <View style={s.cell}><TextField label={mode === 'return' ? 'Returned on (YYYY-MM-DD)' : 'Date (YYYY-MM-DD)'} value={date} onChangeText={setDate} testID="tool-date" /></View> : null}
        {['issue', 'repaired', 'service'].includes(mode) ? <View style={s.cell}><TextField label={mode === 'issue' ? 'Expected return (YYYY-MM-DD)' : 'Next service due (YYYY-MM-DD)'} value={due} onChangeText={setDue} testID="tool-due" /></View> : null}
        {['repair', 'repaired', 'service'].includes(mode) ? <View style={s.cell}><TextField label="Repairer / vendor" value={vendor} onChangeText={setVendor} testID="tool-vendor" /></View> : null}
        {withCost ? <View style={s.cell}><TextField label={mode === 'missing' || mode === 'damaged' ? 'Amount to recover (₹, optional)' : 'Cost (₹)'} value={money} onChangeText={setMoney} keyboardType="decimal-pad" testID="tool-amount" /></View> : null}
      </View>
      {mode !== 'issue' ? <TextField label={mode === 'missing' || mode === 'damaged' ? 'What happened' : 'Remarks'} value={text} onChangeText={setText} maxLength={300} testID="tool-text" /> : null}
      <View style={s.row}>
        <Button title="Save" onPress={() => void save()} loading={busy === key} testID={mode === 'issue' ? 'tool-issue-save' : `tool-${mode}-save`} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}
