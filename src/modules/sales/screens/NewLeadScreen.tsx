import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { spacing } from '../../../shared/designSystem';
import { useAuth } from '../../../shared/store/useAuthStore';
import { salesApi, SOURCES } from '../salesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'NewLead'>;

export function NewLeadScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ clientName: '', contactName: '', phone: '', email: '', siteAddress: '', source: 'call', requirement: '', estValue: '', nextFollowUp: '', ownerId: user?.id ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { salesApi.people().then(setPeople).catch(() => undefined); }, []);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  const save = async () => {
    setError('');
    setErrors({});
    const estValue = f.estValue.trim() ? parseNumber(f.estValue) : 0;
    if (estValue === null) return setErrors({ estValue: 'Enter a number' });
    setBusy(true);
    try {
      const l = await salesApi.create({ ...f, estValue, ownerId: f.ownerId || undefined });
      navigation.replace('LeadDetail', { id: l.id });
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
        setError(e.message);
      } else setError('Could not save');
    }
    setBusy(false);
  };

  return (
    <AppScreen title="New enquiry" onBack={() => navigation.navigate('Sales')} testID="new-lead-screen">
      <TextField label="Client / company" value={f.clientName} onChangeText={set('clientName')} error={errors.clientName} testID="nl-client" />
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Contact person" value={f.contactName} onChangeText={set('contactName')} testID="nl-contact" /></View>
        <View style={styles.grow}><TextField label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} testID="nl-phone" /></View>
        <View style={styles.grow}><TextField label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={errors.email} testID="nl-email" /></View>
      </View>
      <TextField label="Site address" value={f.siteAddress} onChangeText={set('siteAddress')} testID="nl-site" />
      <TextField label="What do they need?" value={f.requirement} onChangeText={set('requirement')} multiline placeholder="e.g. VRF for 3 floors, approx 60 TR" testID="nl-req" />
      <ChoiceChips label="How did it come?" options={SOURCES} value={f.source} onChange={set('source')} testID="nl-source" />
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Estimated value (₹)" value={f.estValue} onChangeText={set('estValue')} keyboardType="decimal-pad" error={errors.estValue} testID="nl-value" /></View>
        <View style={styles.grow}><TextField label="Next follow-up (YYYY-MM-DD)" value={f.nextFollowUp} onChangeText={set('nextFollowUp')} error={errors.nextFollowUp} testID="nl-follow" /></View>
      </View>
      {people.length > 1 ? <ChoiceChips label="Handled by" options={people.map((p) => ({ value: p.id, label: p.name }))} value={f.ownerId} onChange={set('ownerId')} testID="nl-owner" /> : null}
      {error ? <ErrorBanner message={error} testID="nl-error" /> : null}
      <Button title="Save enquiry" onPress={save} loading={busy} testID="nl-save" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  grow: { flexGrow: 1, minWidth: 180 },
  self: { alignSelf: 'flex-start' },
});
