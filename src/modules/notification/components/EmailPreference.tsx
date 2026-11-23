import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { api, ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { colors, spacing } from '../../../shared/designSystem';
import type { User } from '../../auth/types';

// The person's own switch for approval e-mails (Q1). Phone and in-app notifications are not affected.
export function EmailPreference() {
  const { user, setCurrentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;
  const on = user.emailNotifications !== false;
  const toggle = async (value: boolean) => {
    setBusy(true); setError('');
    try { setCurrentUser(await api<User>('/auth/me/preferences', { method: 'PATCH', body: { emailNotifications: value } })); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  return (
    <View style={styles.row}>
      <Switch value={on} onValueChange={toggle} disabled={busy} testID="email-pref" accessibilityLabel="E-mail me about approvals" />
      <Text style={styles.text}>E-mail me about approvals{user.email ? ` (${user.email})` : ''}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  text: { color: colors.textMuted },
  error: { color: colors.danger },
});
