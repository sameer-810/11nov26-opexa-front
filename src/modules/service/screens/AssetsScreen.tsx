import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import type { Project } from '../../project/types';
import { fullPublicUrl, serviceApi, shareLink, splitSerials, type Asset } from '../api/serviceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceAssets'>;

export function AssetsScreen({ navigation }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', brand: '', model: '', serials: '', location: '', installedOn: todayLocal(), warrantyMonths: '12', pmEveryMonths: '3' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [linkInfo, setLinkInfo] = useState('');

  useEffect(() => {
    projectApi.list().then((p) => { setProjects(p); if (p[0]) setProjectId(p[0].id); }).catch(() => setProjects([]));
  }, []);
  const load = useCallback(async () => {
    if (!projectId) return;
    setRows(null);
    try { setRows(await serviceApi.assets(projectId)); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load'); }
  }, [projectId]);
  useEffect(() => { setLinkInfo(''); void load(); }, [load]);

  const project = projects?.find((p) => p.id === projectId);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  const save = async () => {
    setError('');
    const warrantyMonths = parseNumber(f.warrantyMonths);
    const pmEveryMonths = parseNumber(f.pmEveryMonths || '0');
    if (warrantyMonths === null || pmEveryMonths === null) return setError('Warranty and service gap must be numbers of months');
    const serials = splitSerials(f.serials);
    setBusy('save');
    try {
      await serviceApi.addAssets({ projectId, name: f.name.trim(), brand: f.brand.trim() || undefined, model: f.model.trim() || undefined, serials: serials.length ? serials : [''], location: f.location.trim() || undefined, installedOn: f.installedOn.trim(), warrantyMonths, pmEveryMonths });
      setF((o) => ({ ...o, name: '', brand: '', model: '', serials: '', location: '' }));
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Could not save');
    }
    setBusy('');
  };

  const share = async () => {
    setError('');
    setBusy('link');
    try {
      const url = fullPublicUrl((await serviceApi.publicLink(projectId)).path);
      const how = await shareLink(url, project?.name ?? '');
      setLinkInfo(how === 'copied' ? `Link copied. Send it to the client: ${url}` : how === 'shown' ? `Send this link to the client: ${url}` : `Client link: ${url}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not make the link');
    }
    setBusy('');
  };

  const today = todayLocal();
  return (
    <AppScreen title="Equipment & warranty" subtitle="Installed units, warranty dates and service schedule" onBack={() => navigation.navigate('Service')} testID="assets-screen">
      {!projects ? <ActivityIndicator /> : <ChoiceChips label="Project / site" options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} value={projectId} onChange={setProjectId} testID="as-project" />}
      {projectId ? (
        <View style={styles.row}>
          <Button title="Add equipment" onPress={() => setAdding((a) => !a)} variant={adding ? 'outline' : 'primary'} testID="as-add" />
          <Button title="Send complaint link to client" variant="outline" onPress={share} loading={busy === 'link'} testID="as-link" />
        </View>
      ) : null}
      {linkInfo ? <Text style={styles.info} selectable testID="as-link-info">{linkInfo}</Text> : null}
      {adding ? (
        <View style={styles.box}>
          <TextField label="Equipment" value={f.name} onChangeText={set('name')} placeholder="e.g. Split AC 1.5 TR" testID="as-name" />
          <View style={styles.row}>
            <View style={styles.grow}><TextField label="Brand" value={f.brand} onChangeText={set('brand')} testID="as-brand" /></View>
            <View style={styles.grow}><TextField label="Model" value={f.model} onChangeText={set('model')} testID="as-model" /></View>
          </View>
          <TextField label="Serial numbers (one per line or comma separated - one unit each)" value={f.serials} onChangeText={set('serials')} multiline testID="as-serials" />
          <TextField label="Location at site" value={f.location} onChangeText={set('location')} placeholder="e.g. 3rd floor, cabin 2" testID="as-location" />
          <View style={styles.row}>
            <View style={styles.grow}><TextField label="Installed on (YYYY-MM-DD)" value={f.installedOn} onChangeText={set('installedOn')} testID="as-installed" /></View>
            <View style={styles.grow}><TextField label="Warranty (months)" value={f.warrantyMonths} onChangeText={set('warrantyMonths')} keyboardType="number-pad" testID="as-warranty" /></View>
            <View style={styles.grow}><TextField label="Service every (months, 0 = none)" value={f.pmEveryMonths} onChangeText={set('pmEveryMonths')} keyboardType="number-pad" testID="as-pm" /></View>
          </View>
          <Button title={`Save ${Math.max(1, splitSerials(f.serials).length)} unit(s)`} onPress={save} loading={busy === 'save'} testID="as-save" style={styles.self} />
        </View>
      ) : null}
      {error ? <ErrorBanner message={error} testID="as-error" /> : null}
      {projectId && !rows ? <ActivityIndicator /> : null}
      {rows && !rows.length ? <EmptyState title="No equipment yet" body="Add the units you installed to track warranty and send service reminders." /> : null}
      {rows?.map((a) => (
        <View key={a.id} style={styles.card} testID={`as-row-${a.serialNo || a.id}`}>
          <View style={styles.row}>
            <Text style={styles.title}>{a.name}{a.brand || a.model ? ` · ${[a.brand, a.model].filter(Boolean).join(' ')}` : ''}</Text>
            <StatusChip label={a.underWarranty ? `Warranty till ${formatDate(a.warrantyEnd)}` : `Warranty over ${formatDate(a.warrantyEnd)}`} tone={a.underWarranty ? 'success' : 'warning'} />
          </View>
          <Text style={styles.muted}>
            S/N {a.serialNo || '-'}{a.location ? ` · ${a.location}` : ''} · installed {formatDate(a.installedOn)}
            {a.nextPmDate ? ` · next service ${formatDate(a.nextPmDate)}${a.nextPmDate <= today ? ' (due)' : ''}` : ''}
          </Text>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  grow: { flexGrow: 1, minWidth: 160 },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  info: { fontSize: 14, color: colors.text, backgroundColor: '#E0F2FE', padding: spacing.sm, borderRadius: radius.md },
  self: { alignSelf: 'flex-start' },
});
