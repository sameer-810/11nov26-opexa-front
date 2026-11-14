import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { spacing } from '../../../shared/designSystem';
import { teamApi } from '../api/teamApi';
import { ROLE_HINT, ROLE_LABEL, type NewMemberInput } from '../types';
import { generateTempPassword, validateNewMember, type MemberErrors } from '../team.validation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMember'>;
const ROLES = ['engineer', 'supervisor', 'purchaser', 'accounts', 'staff'] as const;

export function AddMemberScreen({ navigation }: Props) {
  const [form, setForm] = useState<NewMemberInput>({ name: '', email: '', phone: '', role: '', password: generateTempPassword() });
  const [errors, setErrors] = useState<MemberErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof NewMemberInput) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    setFormError('');
    const found = validateNewMember(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const member = await teamApi.create({ ...form, email: form.email.trim() });
      navigation.replace('MemberDetail', { id: member.id, tempPassword: form.password });
    } catch (e) {
      if (e instanceof ApiError) {
        const fe: MemberErrors = {};
        e.details.forEach((d) => {
          fe[d.field as keyof NewMemberInput] = d.message;
        });
        setErrors(fe);
        setFormError(e.message);
      } else setFormError('Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Add team member" subtitle="They sign in with this email and the temporary password" onBack={() => navigation.goBack()} testID="add-member-screen">
      <View style={styles.form}>
        {formError ? <ErrorBanner message={formError} testID="add-member-error" /> : null}
        <TextField label="Full name" testID="member-name" value={form.name} onChangeText={set('name')} error={errors.name} />
        <TextField label="Email" testID="member-email" value={form.email} onChangeText={set('email')} error={errors.email} autoCapitalize="none" keyboardType="email-address" inputMode="email" />
        <TextField label="Mobile number" testID="member-phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" inputMode="tel" />
        <ChoiceChips
          label="Role"
          testID="member-role"
          value={form.role}
          onChange={set('role')}
          error={errors.role}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], hint: ROLE_HINT[r] }))}
        />
        <TextField label="Temporary password" testID="member-password" value={form.password} onChangeText={set('password')} error={errors.password} autoCapitalize="characters" />
        <Button title="Generate a new password" variant="ghost" onPress={() => set('password')(generateTempPassword())} testID="member-generate" />
        <Button title="Add member" onPress={submit} loading={busy} testID="member-submit" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.md, maxWidth: 560 } });
