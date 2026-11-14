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
import { validateSignUp, type Errors } from '../auth.validation';
import type { SignUpInput } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;
type Form = SignUpInput & { confirmPassword: string };

const empty: Form = { companyName: '', name: '', email: '', phone: '', password: '', confirmPassword: '' };

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors<SignUpInput>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    setFormError('');
    const found = validateSignUp(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { confirmPassword: _c, ...input } = form;
      await signUp({ ...input, email: input.email.trim() });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors: Errors<SignUpInput> = {};
        err.details.forEach((d) => {
          fieldErrors[d.field as keyof SignUpInput] = d.message;
        });
        setErrors(fieldErrors);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your company account"
      subtitle="You will be the owner. You can add your team after signing up."
      onLogoPress={Platform.OS === 'web' ? () => navigation.navigate('Landing') : undefined}
    >
      <View testID="signup-screen" style={styles.gap}>
        {formError ? <ErrorBanner message={formError} testID="signup-error" /> : null}
        <TextField label="Company name" testID="signup-company" value={form.companyName} onChangeText={set('companyName')} error={errors.companyName} autoComplete="organization" />
        <TextField label="Your name" testID="signup-name" value={form.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
        <TextField
          label="Email"
          testID="signup-email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <TextField label="Mobile number" testID="signup-phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" inputMode="tel" autoComplete="tel" />
        <TextField
          label="Password"
          testID="signup-password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          secureTextEntry
          autoComplete="new-password"
          placeholder="At least 8 characters, with a letter and a number"
        />
        <TextField
          label="Confirm password"
          testID="signup-confirm"
          value={form.confirmPassword}
          onChangeText={set('confirmPassword')}
          error={errors.confirmPassword}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        <Button title="Create account" onPress={submit} loading={busy} testID="signup-submit" />
        <Text style={styles.footer}>
          Already have an account?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('SignIn')} accessibilityRole="link" testID="goto-signin">
            Sign in
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
