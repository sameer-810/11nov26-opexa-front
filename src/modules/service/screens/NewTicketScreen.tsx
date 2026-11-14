import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { spacing, colors } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import type { Project } from '../../project/types';
import { serviceApi, type Asset } from '../api/serviceApi';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTicket'>;

export function NewTicketScreen({ navigation, route }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState(route.params?.projectId ?? '');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectApi.list().then((p) => setProjects(p.filter((x) => x.status !== 'closed'))).catch(() => setProjects([]));
  }, []);
  useEffect(() => {
    setAssetId('');
    if (projectId) serviceApi.assets(projectId).then(setAssets).catch(() => setAssets([]));
  }, [projectId]);

  const save = async () => {
    setError('');
    if (!projectId) return setError('Pick the project / site');
    setBusy(true);
    try {
      const t = await serviceApi.create({ projectId, assetId: assetId || undefined, title: title.trim(), description: description.trim() || undefined, priority, contactName: contactName.trim() || undefined, contactPhone: contactPhone.trim() || undefined });
      navigation.replace('TicketDetail', { id: t.id });
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Could not save');
    }
    setBusy(false);
  };

  return (
    <AppScreen title="New complaint" subtitle="Log a client call or a fault found on site" onBack={() => navigation.navigate('Service')} testID="new-ticket-screen">
      {!projects ? <ActivityIndicator /> : (
        <ChoiceChips label="Project / site" options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} value={projectId} onChange={setProjectId} testID="nt-project" />
      )}
      {projectId && assets.length ? (
        <ChoiceChips label="Which unit? (optional)" options={[{ value: '', label: 'Not sure' }, ...assets.map((a) => ({ value: a.id, label: `${[a.location, a.name, a.serialNo].filter(Boolean).join(' · ')}${a.underWarranty ? '' : ' (warranty over)'}` }))]} value={assetId} onChange={setAssetId} testID="nt-asset" />
      ) : projectId ? <Text style={styles.muted}>No equipment registered for this site yet - you can still log the complaint.</Text> : null}
      <TextField label="Problem" value={title} onChangeText={setTitle} placeholder="e.g. AC not cooling in cabin 2" testID="nt-title" />
      <TextField label="Details (optional)" value={description} onChangeText={setDescription} multiline testID="nt-desc" />
      <ChoiceChips label="Priority" options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }]} value={priority} onChange={(v) => setPriority(v as typeof priority)} testID="nt-priority" />
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Client contact name" value={contactName} onChangeText={setContactName} testID="nt-cname" /></View>
        <View style={styles.grow}><TextField label="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" testID="nt-cphone" /></View>
      </View>
      {error ? <ErrorBanner message={error} testID="nt-error" /> : null}
      <Button title="Save complaint" onPress={save} loading={busy} testID="nt-save" style={styles.self} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  grow: { flexGrow: 1, minWidth: 200 },
  muted: { fontSize: 13, color: colors.textMuted },
  self: { alignSelf: 'flex-start' },
});
