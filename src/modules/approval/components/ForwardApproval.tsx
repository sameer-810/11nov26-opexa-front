import { useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { s } from '../../inventory/ui';
import { approvalApi } from '../api/approvalApi';

type Option = { id: string; name: string; label: string };

// Workflow Phase C: the current approver hands this request to another approver of the project, with a reason.
export function ForwardApproval({ approvalId, onDone }: { approvalId: string; onDone: () => void }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [to, setTo] = useState('');
  const [why, setWhy] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Try again');

  const open = async () => {
    setProblem('');
    try { setOptions(await approvalApi.forwardOptions(approvalId)); } catch (e) { setProblem(message(e)); }
  };
  const send = async () => {
    if (!to) return setProblem('Choose who to forward it to');
    if (why.trim().length < 3) return setProblem('Say why you are forwarding it');
    setBusy(true); setProblem('');
    try { await approvalApi.forward(approvalId, to, why.trim()); onDone(); } catch (e) { setProblem(message(e)); } finally { setBusy(false); }
  };

  if (!options) {
    return (
      <View style={s.list}>
        <Button title="Forward" variant="ghost" onPress={open} testID={`forward-${approvalId}`} style={s.self} />
        {problem ? <ErrorBanner message={problem} /> : null}
      </View>
    );
  }
  return (
    <View style={s.form} testID="forward-panel">
      {options.length ? (
        <ChoiceChips label="Forward to" value={to} onChange={setTo} options={options.map((o) => ({ value: o.id, label: `${o.name} · ${o.label}` }))} testID="forward-to" />
      ) : <Text style={s.muted}>Nobody else may approve this project's requests.</Text>}
      <TextField label="Reason" value={why} onChangeText={setWhy} maxLength={500} testID="forward-reason" />
      {problem ? <ErrorBanner message={problem} testID="forward-problem" /> : null}
      <View style={s.row}>
        <Button title="Forward" onPress={send} loading={busy} disabled={!options.length} testID="forward-send" />
        <Button title="Cancel" variant="ghost" onPress={() => { setOptions(null); setTo(''); setWhy(''); }} />
      </View>
    </View>
  );
}
