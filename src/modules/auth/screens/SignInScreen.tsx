import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { ApiError } from '../../../shared/api/apiClient';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors } from '../../../shared/designSystem';
import { AuthLayout } from '../components/AuthLayout';
import { validateSignIn, type Errors } from '../auth.validation';
import type { SignInInput } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [form, setForm] = useState<SignInInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<Errors<SignInInput>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof SignInInput) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    setFormError('');
    const found = validateSignIn(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await signIn({ email: form.email.trim(), password: form.password });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to your company account."
      onLogoPress={Platform.OS === 'web' ? () => navigation.navigate('Landing') : undefined}
    >
      <View testID="signin-screen" style={styles.gap}>
        {formError ? <ErrorBanner message={formError} testID="signin-error" /> : null}
        <TextField
          label="Email"
          testID="signin-email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <TextField
          label="Password"
          testID="signin-password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
        <Button title="Sign in" onPress={submit} loading={busy} testID="signin-submit" />
        <Text style={styles.footer}>
          New to Opexa?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('SignUp')} accessibilityRole="link" testID="goto-signup">
            Create a company account
          </Text>
        </Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '600' },
});
