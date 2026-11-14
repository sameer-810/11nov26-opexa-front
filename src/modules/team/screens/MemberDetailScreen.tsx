import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { passwordProblem } from '../../auth/auth.validation';
import { teamApi } from '../api/teamApi';
import { PermissionEditor } from '../components/PermissionEditor';
import { useTeamMeta } from '../hooks/useTeamMeta';
import { generateTempPassword } from '../team.validation';
import { ROLE_HINT, ROLE_LABEL, type TeamMember } from '../types';
import type { Role } from '../../auth/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberDetail'>;

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function MemberDetailScreen({ navigation, route }: Props) {
  const { id, tempPassword } = route.params;
  const { user: me } = useAuth();
  const { meta } = useTeamMeta();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loadError, setLoadError] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [perms, setPerms] = useState<string[]>([]);
  const [message, setMessage] = useState(tempPassword ? `Member added. Share the temporary password: ${tempPassword}` : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'active' | 'reset'>('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const apply = (m: TeamMember) => {
    setMember(m);
    setRole(m.role);
    setPerms(m.permissions);
  };

  const load = useCallback(async () => {
    setLoadError('');
    try {
      apply(await teamApi.get(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (kind: 'save' | 'active' | 'reset', fn: () => Promise<TeamMember>, done: string) => {
    setError('');
    setMessage('');
    setBusy(kind);
    try {
      apply(await fn());
      setMessage(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  if (loadError) return <AppScreen title="Team member" onBack={() => navigation.navigate('Team')}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!member || !meta) return <AppScreen title="Team member" onBack={() => navigation.navigate('Team')}><ActivityIndicator /></AppScreen>;

  const isOwner = member.role === 'owner';
  const isSelf = member.id === me?.id;
  const changed = role !== member.role || !sameSet(perms, member.permissions);

  const onRoleChange = (r: string) => {
    setRole(r as Role);
    setPerms(meta.roleDefaults[r as Role] ?? []);
  };

  const save = () =>
    run('save', () => teamApi.update(member.id, { ...(role !== member.role ? { role: role as Role } : {}), permissions: perms }), 'Changes saved');

  const toggleActive = () =>
    run('active', () => teamApi.update(member.id, { isActive: !member.isActive }), member.isActive ? 'Member deactivated and signed out' : 'Member re-activated').then(() =>
      setConfirmDeactivate(false),
    );

  const resetPassword = () => {
    const problem = passwordProblem(newPassword);
    setPwError(problem ?? '');
    if (problem) return;
    run('reset', () => teamApi.resetPassword(member.id, newPassword), `Password reset. Share the new temporary password: ${newPassword}`).then(() => setNewPassword(''));
  };

  return (
    <AppScreen
      title={member.name}
      subtitle={`${member.email}${member.phone ? ` · ${member.phone}` : ''}`}
      onBack={() => navigation.navigate('Team')}
      right={
        <View style={styles.chips}>
          <StatusChip label={ROLE_LABEL[member.role]} tone={isOwner ? 'info' : 'neutral'} />
          <StatusChip label={member.isActive ? 'Active' : 'Deactivated'} tone={member.isActive ? 'success' : 'danger'} testID="member-status" />
        </View>
      }
      testID="member-detail-screen"
    >
      {message ? (
        <View style={styles.notice} testID="member-message">
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}
      {error ? <ErrorBanner message={error} testID="member-error" /> : null}

      {isOwner ? (
        <Text style={styles.muted}>The owner always has full access. Their role and access cannot be changed.</Text>
      ) : (
        <>
          <ChoiceChips
            label="Role"
            testID="detail-role"
            value={role}
            onChange={onRoleChange}
            options={meta.roles.map((r) => ({ value: r, label: ROLE_LABEL[r], hint: ROLE_HINT[r] }))}
          />
          <Text style={styles.section}>Access</Text>
          <Text style={styles.muted}>Changing the role resets these to that role's defaults. You can then switch any of them on or off.</Text>
          <PermissionEditor catalog={meta.permissions} value={perms} onChange={setPerms} />
          <Button title="Save changes" onPress={save} loading={busy === 'save'} disabled={!changed} testID="save-member" />
        </>
      )}

      {!isOwner && !isSelf ? (
        <View style={styles.card}>
          <Text style={styles.section}>Reset password</Text>
          <Text style={styles.muted}>They will be signed out and asked to set their own password after signing in.</Text>
          <TextField label="New temporary password" value={newPassword} onChangeText={(v) => { setNewPassword(v); setPwError(''); }} error={pwError} testID="reset-password-input" autoCapitalize="characters" />
          <View style={styles.row}>
            <Button title="Generate" variant="ghost" onPress={() => setNewPassword(generateTempPassword())} />
            <Button title="Reset password" variant="outline" onPress={resetPassword} loading={busy === 'reset'} testID="reset-password" />
          </View>
        </View>
      ) : null}

      {!isOwner && !isSelf ? (
        <View style={styles.card}>
          <Text style={styles.section}>{member.isActive ? 'Deactivate' : 'Re-activate'}</Text>
          <Text style={styles.muted}>
            {member.isActive
              ? 'A deactivated member is signed out at once and cannot sign in. Their records stay.'
              : 'Let this member sign in again.'}
          </Text>
          {member.isActive && !confirmDeactivate ? (
            <Button title="Deactivate member" variant="outline" onPress={() => setConfirmDeactivate(true)} testID="deactivate" />
          ) : null}
          {member.isActive && confirmDeactivate ? (
            <View style={styles.row}>
              <Button title="Yes, deactivate" onPress={toggleActive} loading={busy === 'active'} testID="confirm-deactivate" style={styles.danger} />
              <Button title="Cancel" variant="ghost" onPress={() => setConfirmDeactivate(false)} />
            </View>
          ) : null}
          {!member.isActive ? <Button title="Re-activate member" onPress={toggleActive} loading={busy === 'active'} testID="reactivate" /> : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 14, color: colors.textMuted },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  notice: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  noticeText: { color: '#065F46', fontSize: 14, fontWeight: '600' },
  danger: { backgroundColor: colors.danger },
});
