import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatDateTime } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { s, useAction, useData } from '../../inventory/ui';
import { ROLE_LABEL } from '../../team/types';
import type { Role } from '../../auth/types';
import { projectApi } from '../api/projectApi';

type Props = { projectId: string; siteId: string; manage: boolean; onChanged: () => void };

const roleText = (r: string) => ROLE_LABEL[r as Role] ?? r;
const ACTION: Record<string, string> = { created: 'Site created', updated: 'Site details changed', engineer_changed: 'Site engineer changed' };

// One site: its primary engineer (managers can change it), who held it before, who works there, and its history.
export function SitePanel({ projectId, siteId, manage, onChanged }: Props) {
  const fetcher = useCallback(() => Promise.all([projectApi.site(projectId, siteId), manage ? projectApi.siteEngineers(projectId) : Promise.resolve([])]), [projectId, siteId, manage]);
  const { data, error, reload } = useData(fetcher);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { busy, problem, run } = useAction(() => { setPick(null); setNote(''); void reload(); onChanged(); });
  if (error) return <ErrorBanner message={error} testID="site-panel-error" />;
  if (!data) return null;
  const [site, engineers] = data;
  const chosen = pick ?? site.engineer?.id ?? '';

  return (
    <View style={[s.form, { marginTop: 8 }]} testID={`site-panel-${site.code}`}>
      <Text style={s.title}>Site engineer</Text>
      <Text style={s.muted} testID="site-engineer">{site.engineer ? site.engineer.name : 'No site engineer yet'}</Text>
      {manage && site.isActive ? (
        <>
          {engineers.length ? (
            <ChoiceChips label="Primary site engineer" value={chosen} onChange={setPick} options={engineers.map((e) => ({ value: e.id, label: e.name }))} testID="site-engineer-pick" />
          ) : <Text style={s.muted}>Add a team member with the Project Engineer role first.</Text>}
          {pick && pick !== site.engineer?.id ? (
            <>
              <TextField label="Note (optional)" value={note} onChangeText={setNote} maxLength={300} testID="site-engineer-note" />
              <Button title={site.engineer ? 'Reassign site engineer' : 'Assign site engineer'} onPress={() => run('set', () => projectApi.setSiteEngineer(projectId, siteId, { userId: pick, note: note.trim() || undefined }))} loading={busy === 'set'} style={s.self} testID="site-engineer-save" />
            </>
          ) : null}
          {problem ? <ErrorBanner message={problem} testID="site-engineer-problem" /> : null}
        </>
      ) : null}

      {site.engineerHistory.length ? (
        <>
          <Text style={[s.title, { marginTop: 8 }]}>Engineer history</Text>
          {site.engineerHistory.map((h, i) => (
            <Text key={`${h.userId}-${h.from}`} style={s.muted} testID={`site-history-${i}`}>
              {h.name} · {formatDate(h.from)} – {h.to ? formatDate(h.to) : 'now'} · by {h.assignedBy}{h.note ? ` · ${h.note}` : ''}
            </Text>
          ))}
        </>
      ) : null}

      <Text style={[s.title, { marginTop: 8 }]}>Team on this site</Text>
      {site.team.map((m) => (
        <Text key={m.id} style={s.muted} testID={`site-team-${m.id}`}>{m.name} · {roleText(m.role)}{m.allSites ? ' · all sites' : ''}</Text>
      ))}

      <Text style={[s.title, { marginTop: 8 }]}>Activity</Text>
      {site.activity.map((a, i) => (
        <Text key={`${a.at}-${i}`} style={s.muted}>
          {formatDateTime(a.at)} · {ACTION[a.action] ?? a.action} · {a.by}
          {a.changes.length ? ` · ${a.changes.map((c) => `${String(c.old ?? '')} → ${String(c.new ?? '')}`).join(', ')}` : ''}
          {a.remarks ? ` · ${a.remarks}` : ''}
        </Text>
      ))}
    </View>
  );
}
