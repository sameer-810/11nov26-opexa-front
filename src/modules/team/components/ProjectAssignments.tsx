import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/apiClient';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { teamApi } from '../api/teamApi';
import type { AssignmentInput, AssignmentOptions } from '../types';

type Props = { userId: string; canEdit: boolean };
type Draft = Record<string, AssignmentInput>;

// Phase 2 access: which projects a person works on and, inside each, which sites (none ticked = every site).
// Rates and amounts of a project show for non-finance roles only with "finance access".
export function ProjectAssignments({ userId, canEdit }: Props) {
  const [options, setOptions] = useState<AssignmentOptions | null>(null);
  const [seesAll, setSeesAll] = useState(false);
  const [saved, setSaved] = useState<Draft>({});
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (rows: AssignmentInput[]) => {
    const d = Object.fromEntries(rows.map((r) => [r.projectId, { projectId: r.projectId, siteIds: r.siteIds, financeAccess: r.financeAccess }]));
    setSaved(d);
    setDraft(d);
  };
  const load = useCallback(async () => {
    setError('');
    try {
      const [o, a] = await Promise.all([teamApi.assignmentOptions(), teamApi.assignments(userId)]);
      setOptions(o);
      setSeesAll(a.seesAllProjects);
      apply(a.assignments);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the projects');
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  if (!options) return error ? <ErrorBanner message={error} testID="assign-error" /> : <ActivityIndicator />;

  const toggleProject = (id: string) => setDraft((d) => {
    const next = { ...d };
    if (next[id]) delete next[id];
    else next[id] = { projectId: id, siteIds: [], financeAccess: false };
    return next;
  });
  const toggleSite = (projectId: string, siteId: string) => setDraft((d) => {
    const cur = d[projectId];
    const siteIds = cur.siteIds.includes(siteId) ? cur.siteIds.filter((s) => s !== siteId) : [...cur.siteIds, siteId];
    return { ...d, [projectId]: { ...cur, siteIds } };
  });
  const setFinance = (projectId: string, on: boolean) => setDraft((d) => ({ ...d, [projectId]: { ...d[projectId], financeAccess: on } }));
  const changed = JSON.stringify(Object.values(draft).map((r) => [r.projectId, [...r.siteIds].sort(), r.financeAccess]).sort()) !== JSON.stringify(Object.values(saved).map((r) => [r.projectId, [...r.siteIds].sort(), r.financeAccess]).sort());

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await teamApi.saveAssignments(userId, Object.values(draft));
      apply(res.assignments);
      setMessage('Projects and sites saved. The change applies at once.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="project-assignments">
      <Text style={styles.title}>Projects and sites</Text>
      {seesAll ? <Text style={styles.muted} testID="assign-sees-all">This person sees every project (owner or all-project viewer).</Text> : null}
      <Text style={styles.muted}>Tick the projects this person works on. Inside a project, tick sites to limit them to those sites; no site ticked means every site.</Text>
      {error ? <ErrorBanner message={error} testID="assign-error" /> : null}
      {message ? <Text style={styles.ok} testID="assign-message">{message}</Text> : null}
      {options.projects.length === 0 ? <Text style={styles.muted}>No projects yet.</Text> : null}
      {options.projects.map((p) => {
        const a = draft[p.id];
        return (
          <View key={p.id} style={[styles.card, a && styles.cardOn]}>
            <View style={styles.row}>
              <Text style={styles.project}>{p.code} {p.name}{p.status !== 'active' ? ` (${p.status})` : ''}</Text>
              <Switch value={Boolean(a)} onValueChange={() => toggleProject(p.id)} disabled={!canEdit} accessibilityLabel={`Assign ${p.code}`} testID={`assign-${p.code}`} />
            </View>
            {a ? (
              <>
                <View style={styles.chips}>
                  {p.sites.map((s) => {
                    const on = a.siteIds.includes(s.id);
                    return (
                      <Pressable key={s.id} onPress={() => canEdit && toggleSite(p.id, s.id)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`assign-${p.code}-${s.code}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.muted}>{a.siteIds.length ? `${a.siteIds.length} of ${p.sites.length} site(s)` : 'Every site'}</Text>
                <View style={styles.row}>
                  <Text style={styles.label}>Finance access (rates and amounts)</Text>
                  <Switch value={a.financeAccess} onValueChange={(on) => setFinance(p.id, on)} disabled={!canEdit} accessibilityLabel={`Finance access ${p.code}`} testID={`assign-${p.code}-finance`} />
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      {canEdit ? <Button title="Save projects and sites" onPress={save} loading={busy} disabled={!changed} testID="save-assignments" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  ok: { fontSize: 14, color: colors.success, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  cardOn: { borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  project: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  label: { fontSize: 14, color: colors.text, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
});
