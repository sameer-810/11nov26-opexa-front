import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { formatMoney } from '../../../shared/format';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { projectApi } from '../../project/api/projectApi';
import { DepartmentsCard } from '../../department/DepartmentsCard';
import { approvalApi, TRANSACTION_TYPES, type Person, type Workflow, type WorkflowInput } from '../api/approvalApi';
import { typeLabel, WorkflowForm } from '../components/WorkflowForm';
import { roleName } from '../components/ApprovalHistory';

type Props = NativeStackScreenProps<RootStackParamList, 'ApprovalSettings'>;
type Data = { workflows: Workflow[]; people: Person[]; projects: { id: string; code: string; name: string }[] };

const band = (w: Workflow) => (w.maxAmount != null ? `${formatMoney(w.minAmount)} to ${formatMoney(w.maxAmount)}` : w.minAmount > 0 ? `${formatMoney(w.minAmount)} and above` : 'Any amount');
const asInput = (w: Workflow, isActive: boolean): WorkflowInput => ({
  name: w.name, transactionType: w.transactionType, projectId: w.projectId, departmentId: w.departmentId, minAmount: w.minAmount, maxAmount: w.maxAmount, isActive,
  levels: w.levels.map((l) => (l.approverUserId ? { sequence: l.sequence, approverUserId: l.approverUserId } : { sequence: l.sequence, approverRole: l.approverRole ?? '' })),
});

// Approval rules per transaction type: list, create, edit, switch off; restore the default material request chain (Q10).
export function ApprovalSettingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Workflow | 'new' | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [workflows, people, projects] = await Promise.all([approvalApi.workflows(), approvalApi.people(), projectApi.list()]);
      setData({ workflows, people, projects });
    } catch (e) { setLoadError(e instanceof ApiError ? e.message : 'Could not load approval settings'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setError(''); setBusy(key);
    try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Try again'); } finally { setBusy(''); }
  };
  const save = async (input: WorkflowInput) => {
    await approvalApi.saveWorkflow(input, editing && editing !== 'new' ? editing.id : undefined);
    setEditing(null);
    await load();
  };
  const who = (w: Workflow) => w.levels.map((l) => (l.approverUserId ? data?.people.find((p) => p.id === l.approverUserId)?.name ?? 'Person' : roleName(l.approverRole))).join(' → ');

  const back = () => navigation.navigate('Approvals');
  if (loadError) return <AppScreen title="Approval settings" onBack={back}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!data) return <AppScreen title="Approval settings" onBack={back}><ActivityIndicator /></AppScreen>;

  return (
    <AppScreen
      title="Approval settings"
      subtitle="Who approves what, by type, project, department and amount"
      onBack={back}
      right={<Button title="Restore default chain" variant="outline" onPress={() => run('restore', approvalApi.restoreDefault)} loading={busy === 'restore'} testID="restore-default" />}
      testID="approval-settings-screen"
    >
      {error ? <ErrorBanner message={error} testID="settings-error" /> : null}
      {editing ? (
        <WorkflowForm key={editing === 'new' ? 'new' : editing.id} workflow={editing === 'new' ? null : editing} people={data.people} projects={data.projects} onSave={save} onCancel={() => setEditing(null)} />
      ) : <Button title="New workflow" onPress={() => setEditing('new')} testID="new-workflow" />}
      {TRANSACTION_TYPES.filter((t) => data.workflows.some((w) => w.transactionType === t)).map((t) => (
        <View key={t} style={styles.group}>
          <Text style={styles.groupTitle}>{typeLabel(t)}</Text>
          {data.workflows.filter((w) => w.transactionType === t).map((w) => (
            <View key={w.id} style={styles.card} testID={`workflow-${w.id}`}>
              <View style={styles.row}>
                <Text style={styles.name}>{w.name}</Text>
                {w.isDefault ? <StatusChip label="Default" tone="info" /> : null}
                <StatusChip label={w.isActive ? 'On' : 'Off'} tone={w.isActive ? 'success' : 'neutral'} />
              </View>
              <Text style={styles.muted}>
                {[band(w), w.projectId ? `Project ${data.projects.find((p) => p.id === w.projectId)?.code ?? ''}` : null, w.department ? `Dept ${w.department}` : null].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.text} testID={`workflow-levels-${w.id}`}>{who(w)}</Text>
              <View style={styles.row}>
                <Button title="Edit" variant="outline" onPress={() => setEditing(w)} testID={`edit-workflow-${w.id}`} />
                {w.isDefault ? null : <Button title={w.isActive ? 'Switch off' : 'Switch on'} variant="ghost" onPress={() => run(w.id, () => approvalApi.saveWorkflow(asInput(w, !w.isActive), w.id))} loading={busy === w.id} testID={`toggle-workflow-${w.id}`} />}
              </View>
            </View>
          ))}
        </View>
      ))}
      {data.workflows.length === 0 ? <Text style={styles.muted} testID="no-workflows">No workflows yet. Material requests use the default chain: Purchaser → Project Manager, plus Director from ₹1,00,000.</Text> : null}
      {can(user, PERMS.SETTINGS_MANAGE) ? <DepartmentsCard /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { color: colors.text },
  muted: { color: colors.textMuted },
});
