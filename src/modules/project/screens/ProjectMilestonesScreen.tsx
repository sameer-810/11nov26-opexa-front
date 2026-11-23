import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { s, useData } from '../../inventory/ui';
import { projectApi } from '../api/projectApi';
import { MilestoneForm } from '../components/MilestoneForm';
import { MILESTONE_LABEL, type AssignableUser, type Milestone, type MilestoneList, type MilestoneStatus, type Project } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectMilestones'>;
const TONE: Record<MilestoneStatus, 'neutral' | 'info' | 'success' | 'danger'> = { planned: 'neutral', in_progress: 'info', done: 'success', delayed: 'danger' };

// Project schedule (1A.3): milestones with planned / actual dates, owner and status. Project managers edit.
export function ProjectMilestonesScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const fetchAll = useCallback(async (): Promise<{ project: Project; list: MilestoneList }> => {
    const [project, list] = await Promise.all([projectApi.get(id), projectApi.milestones(id)]);
    return { project, list };
  }, [id]);
  const { data, error, reload } = useData(fetchAll);
  const [list, setList] = useState<MilestoneList | null>(null);
  const [people, setPeople] = useState<AssignableUser[]>([]);
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null);
  const canEdit = Boolean(data && (can(user, PERMS.PROJECT_MANAGE) || (user && data.project.projectManagerId === user.id)));

  useEffect(() => { if (data) setList(data.list); }, [data]);
  useEffect(() => {
    if (!canEdit || !data) return;
    // Owners: the project team (names come from the assignable-users list managers can read).
    void projectApi.assignableUsers().then((all) => setPeople(all.filter((u) => data.project.memberIds.includes(u.id)))).catch(() => setPeople([]));
  }, [canEdit, data]);

  const back = () => navigation.navigate('ProjectDetail', { id });
  if (error) return <AppScreen title="Schedule" onBack={back}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  if (!data || !list) return <AppScreen title="Schedule" onBack={back}><ActivityIndicator /></AppScreen>;

  const saved = (next: MilestoneList) => { setList(next); setEditing(null); };
  const { progress } = list;

  return (
    <AppScreen
      title="Schedule milestones"
      subtitle={`${data.project.code} · ${data.project.name}`}
      onBack={back}
      right={canEdit && !editing ? <Button title="Add milestone" onPress={() => setEditing('new')} testID="ms-add" /> : null}
      testID="milestones-screen"
    >
      <Text style={s.title} testID="ms-progress">
        {progress.done} of {progress.total} done · {progress.progressPct}%{progress.delayed ? ` · ${progress.delayed} delayed` : ''}
      </Text>
      {editing ? (
        <MilestoneForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          people={people}
          onCancel={() => setEditing(null)}
          onSave={async (input) => saved(editing === 'new' ? await projectApi.addMilestone(id, input) : await projectApi.updateMilestone(id, editing.id, input))}
          onRemove={editing === 'new' ? undefined : async () => saved(await projectApi.removeMilestone(id, editing.id))}
        />
      ) : null}
      {list.milestones.length === 0 ? (
        <EmptyState title="No milestones yet" body={canEdit ? 'Add the key dates of the job: supply, installation, testing, handover.' : 'The project manager has not set the schedule yet.'} />
      ) : (
        <View style={s.list}>
          {list.milestones.map((m) => (
            <Pressable key={m.id} disabled={!canEdit} onPress={() => setEditing(m)} style={s.card} testID={`ms-row-${m.id}`} accessibilityRole={canEdit ? 'button' : undefined}>
              <View style={s.row}>
                <Text style={s.title}>{m.name}</Text>
                <StatusChip label={MILESTONE_LABEL[m.status]} tone={TONE[m.status]} testID={`ms-status-${m.id}`} />
              </View>
              <Text style={s.muted}>
                Planned {formatDate(m.plannedDate)}{m.actualDate ? ` · Done ${formatDate(m.actualDate)}` : ''}{m.ownerName ? ` · ${m.ownerName}` : ''}
              </Text>
              {m.remarks ? <Text style={s.muted}>{m.remarks}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </AppScreen>
  );
}
