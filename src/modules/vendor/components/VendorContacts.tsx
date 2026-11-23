import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { errText, s } from '../../inventory/ui';
import { vendorApi } from '../api/vendorApi';
import type { VendorContact } from '../types';

type Draft = { name: string; role: string; phone: string; email: string };
const EMPTY: Draft = { name: '', role: '', phone: '', email: '' };
const toInput = (c: VendorContact) => ({ name: c.name, role: c.role ?? undefined, phone: c.phone ?? undefined, email: c.email ?? undefined, isPrimary: c.isPrimary });

// Several contacts per supplier (2A.1); the primary one is used on RFQs and purchase orders.
export function VendorContacts({ vendorId, contacts, onChanged }: { vendorId: string; contacts: VendorContact[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (next: VendorContact[]) => {
    setBusy(true); setProblem('');
    try { await vendorApi.update(vendorId, { contacts: next.map(toInput) }); setDraft(null); onChanged(); } catch (e) { setProblem(errText(e)); } finally { setBusy(false); }
  };
  const add = () => {
    if (!draft || !draft.name.trim()) return setProblem('Enter the contact name');
    return save([...contacts, { name: draft.name.trim(), role: draft.role.trim() || null, phone: draft.phone.trim() || null, email: draft.email.trim() || null, isPrimary: contacts.length === 0 }]);
  };
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...(d ?? EMPTY), [k]: v }));

  return (
    <View style={s.list} testID="vendor-contacts">
      <Text style={s.title}>Contacts</Text>
      {problem ? <Text style={s.danger} testID="contact-problem">{problem}</Text> : null}
      {contacts.length === 0 ? <Text style={s.muted}>No contacts yet</Text> : null}
      {contacts.map((c, i) => (
        <View key={`${c.name}-${i}`} style={s.row} testID={`contact-${c.name}`}>
          <Text style={s.title}>{c.name}</Text>
          <Text style={s.muted}>{[c.role, c.phone, c.email].filter(Boolean).join(' · ')}</Text>
          {c.isPrimary ? <StatusChip label="Primary" tone="info" /> : <Button title="Make primary" variant="ghost" onPress={() => void save(contacts.map((x, j) => ({ ...x, isPrimary: j === i })))} testID={`contact-primary-${c.name}`} />}
          {contacts.length > 1 ? <Button title="Remove" variant="ghost" onPress={() => void save(contacts.filter((_, j) => j !== i))} testID={`contact-remove-${c.name}`} /> : null}
        </View>
      ))}
      {draft ? (
        <View style={s.form}>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Name" value={draft.name} onChangeText={set('name')} testID="contact-name" /></View>
            <View style={s.cell}><TextField label="Role (e.g. Sales, Accounts)" value={draft.role} onChangeText={set('role')} testID="contact-role" /></View>
          </View>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Mobile" value={draft.phone} onChangeText={set('phone')} keyboardType="phone-pad" testID="contact-phone" /></View>
            <View style={s.cell}><TextField label="E-mail" value={draft.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" testID="contact-email" /></View>
          </View>
          <View style={s.row}>
            <Button title="Save contact" onPress={() => void add()} loading={busy} testID="contact-save" />
            <Button title="Cancel" variant="ghost" onPress={() => setDraft(null)} />
          </View>
        </View>
      ) : <Button title="Add contact" variant="outline" onPress={() => setDraft(EMPTY)} testID="contact-add" />}
    </View>
  );
}
