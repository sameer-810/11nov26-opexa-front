import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import type { NewFollowUp } from '../types';
import { errorText, styles } from '../ui';

const METHODS = [{ value: 'call', label: 'Call' }, { value: 'email', label: 'E-mail' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'visit', label: 'Visit' }, { value: 'other', label: 'Other' }];
const STATUSES = [{ value: 'open', label: 'Open' }, { value: 'promised', label: 'Promised' }, { value: 'escalated', label: 'Escalated' }, { value: 'closed', label: 'Closed' }];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function FollowUpForm({ purchaseOrderId, onSaved, onCancel }: { purchaseOrderId: string; onSaved: () => void; onCancel: () => void }) {
  const [method, setMethod] = useState<NewFollowUp['method']>('call');
  const [status, setStatus] = useState('open');
  const [remarks, setRemarks] = useState('');
  const [response, setResponse] = useState('');
  const [next, setNext] = useState('');
  const [promised, setPromised] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (remarks.trim().length < 3) return setProblem('Write what was discussed');
    setBusy(true); setProblem('');
    try {
      await procurementApi.addFollowUp({ purchaseOrderId, method, status, remarks: remarks.trim(), supplierResponse: response.trim() || undefined, nextFollowUpDate: isDate(next) ? next : undefined, promisedDate: isDate(promised) ? promised : undefined });
      onSaved();
    } catch (e) { setProblem(errorText(e)); setBusy(false); }
  };
  return (
    <View style={styles.list} testID="followup-form">
      {problem ? <ErrorBanner message={problem} /> : null}
      <ChoiceChips label="How" options={METHODS} value={method} onChange={(v) => setMethod(v as NewFollowUp['method'])} />
      <ChoiceChips label="Status" options={STATUSES} value={status} onChange={setStatus} />
      <TextField label="What was discussed" value={remarks} onChangeText={setRemarks} multiline testID="fu-remarks" />
      <TextField label="Supplier response" value={response} onChangeText={setResponse} />
      <View style={styles.row}>
        <View style={styles.cell}><TextField label="Promised delivery (YYYY-MM-DD)" value={promised} onChangeText={setPromised} /></View>
        <View style={styles.cell}><TextField label="Next follow-up (YYYY-MM-DD)" value={next} onChangeText={setNext} /></View>
      </View>
      <View style={styles.row}><Button title="Save follow-up" onPress={save} loading={busy} testID="fu-save" /><Button title="Cancel" variant="ghost" onPress={onCancel} /></View>
    </View>
  );
}
