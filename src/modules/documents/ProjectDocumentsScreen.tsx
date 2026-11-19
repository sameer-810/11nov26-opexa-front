import { useCallback, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { api, apiBlob } from '../../shared/api/apiClient';
import { saveBlob } from '../../shared/download';
import { formatDateTime } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDocuments'>;
type Doc = { id: string; folder: string; title: string; restricted: boolean; linkedTo: { type: string; label: string } | null; currentVersion: number; versions: { version: number; name: string; note: string; at: string }[]; comments: { id: string; byName: string; at: string; text: string }[] };

// Shared project folder: drawings, quotations, challans, site photos...; every upload of the same title is a new version.
export function ProjectDocumentsScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const base = `/projects/${id}/documents`;
  const [folder, setFolder] = useState('');
  const fetcher = useCallback(() => api<{ folders: { name: string; count: number }[]; documents: Doc[] }>(`${base}${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`), [base, folder]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  if (error) return <AppScreen title="Project documents" onBack={() => navigation.navigate('ProjectDetail', { id })}><ErrorState message={error} onRetry={reload} /></AppScreen>;

  const upload = (forTitle: string, forFolder: string) => run(`up-${forTitle}`, async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const f = new FormData();
    if (Platform.OS === 'web' && a.file) f.append('file', a.file, a.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else f.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } as any);
    f.append('folder', forFolder);
    f.append('title', forTitle);
    if (note) f.append('note', note);
    await api(base, { method: 'POST', body: f });
    setTitle(''); setNote('');
  });
  const download = (d: Doc, version: number) => run(`dl-${d.id}`, async () => { saveBlob(await apiBlob(`${base}/${d.id}/file?version=${version}`), d.versions[version - 1]?.name || d.title); });

  return (
    <AppScreen title="Project documents" subtitle="One shared folder per project instead of WhatsApp and e-mail" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="documents-screen">
      {problem ? <ErrorBanner message={problem} testID="doc-problem" /> : null}
      {data ? <ChoiceChips label="Folder" options={[{ value: '', label: 'All' }, ...data.folders.map((x) => ({ value: x.name, label: `${x.name}${x.count ? ` (${x.count})` : ''}` }))]} value={folder} onChange={setFolder} testID="doc-folder" /> : null}
      <View style={s.form}>
        <Text style={s.title}>Upload to {folder || 'Other'}</Text>
        <View style={s.row}>
          <View style={s.cell}><TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. HVAC layout L3" testID="doc-title" /></View>
          <View style={s.cell}><TextField label="Version note" value={note} onChangeText={setNote} placeholder="e.g. R1 after client comments" /></View>
        </View>
        <Button title="Choose file and upload" onPress={() => upload(title, folder || 'Other')} disabled={title.trim().length < 2} loading={busy === `up-${title}`} testID="doc-upload" />
        <Text style={s.muted}>PDF, photos, Excel, Word, DWG/DXF up to 10 MB. The same title in the same folder becomes a new version; older versions stay available.</Text>
      </View>
      {data?.documents.map((d) => (
        <View key={d.id} style={s.card} testID={`doc-${d.title}`}>
          <View style={s.row}><Text style={s.title}>{d.title}</Text><StatusChip label={`v${d.currentVersion}`} tone="info" />{d.restricted ? <StatusChip label="Managers only" tone="warning" /> : null}<Text style={s.muted}>{d.folder}{d.linkedTo ? ` · ${d.linkedTo.label || d.linkedTo.type}` : ''}</Text></View>
          {d.versions.slice().reverse().map((v) => (
            <View key={v.version} style={s.row}><Text style={[s.muted, s.cell]}>v{v.version} · {v.name} · {formatDateTime(v.at)}{v.note ? ` · ${v.note}` : ''}</Text><Button title="Download" variant="ghost" onPress={() => download(d, v.version)} /></View>
          ))}
          <View style={s.row}><Button title="Upload new version" variant="outline" onPress={() => upload(d.title, d.folder)} loading={busy === `up-${d.title}`} /></View>
          {d.comments.map((c) => <Text key={c.id} style={s.muted}>{c.byName}, {formatDateTime(c.at)}: {c.text}</Text>)}
          <View style={s.row}>
            <View style={s.cell}><TextField label="Note / comment" value={comment[d.id] ?? ''} onChangeText={(t) => setComment((x) => ({ ...x, [d.id]: t }))} testID={`doc-comment-${d.title}`} /></View>
            <Button title="Add" variant="outline" onPress={() => run(`c-${d.id}`, async () => { await api(`${base}/${d.id}/comments`, { method: 'POST', body: { text: comment[d.id] ?? '' } }); setComment((x) => ({ ...x, [d.id]: '' })); })} testID={`doc-comment-save-${d.title}`} />
          </View>
        </View>
      ))}
    </AppScreen>
  );
}
