import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, spacing } from '../../../shared/designSystem';
import { passwordProblem } from '../../auth/auth.validation';
import { authApi } from '../../auth/api/authApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword' | 'SetPassword'>;
type Form = { currentPassword: string; newPassword: string; confirm: string };

export function ChangePasswordScreen({ navigation }: Props) {
  const { user, setCurrentUser, signOut } = useAuth();
  const forced = Boolean(user?.mustChangePassword);
  const [form, setForm] = useState<Form>({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    setFormError('');
    const e: Partial<Form> = {};
    if (!form.currentPassword) e.currentPassword = forced ? 'Enter the temporary password' : 'Enter your current password';
    const p = passwordProblem(form.newPassword);
    if (p) e.newPassword = p;
    if (form.confirm !== form.newPassword) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const updated = await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setCurrentUser(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe: Partial<Form> = {};
        err.details.forEach((d) => {
          fe[d.field as keyof Form] = d.message;
        });
        setErrors(fe);
        setFormError(err.message);
      } else setFormError('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen
      title={forced ? 'Set your password' : 'Change password'}
      subtitle={forced ? `Welcome${user ? `, ${user.name.split(' ')[0]}` : ''}. Replace the temporary password before you continue.` : undefined}
      onBack={forced ? undefined : () => navigation.navigate('Dashboard')}
      testID="change-password-screen"
    >
      <View style={styles.form}>
        {done && !forced ? <Text style={styles.ok} testID="password-changed">Password changed.</Text> : null}
        {formError ? <ErrorBanner message={formError} testID="change-password-error" /> : null}
        <TextField label={forced ? 'Temporary password' : 'Current password'} testID="cp-current" value={form.currentPassword} onChangeText={set('currentPassword')} error={errors.currentPassword} secureTextEntry />
        <TextField label="New password" testID="cp-new" value={form.newPassword} onChangeText={set('newPassword')} error={errors.newPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters, with a letter and a number" />
        <TextField label="Confirm new password" testID="cp-confirm" value={form.confirm} onChangeText={set('confirm')} error={errors.confirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
        <Button title={forced ? 'Save and continue' : 'Change password'} onPress={submit} loading={busy} testID="cp-submit" />
        {forced ? <Button title="Sign out" variant="ghost" onPress={signOut} testID="cp-signout" /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, maxWidth: 480 },
  ok: { color: colors.success, fontWeight: '700', fontSize: 15 },
});
