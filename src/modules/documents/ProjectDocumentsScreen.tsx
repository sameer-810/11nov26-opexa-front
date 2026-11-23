import { useCallback, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { routeForLink } from '../../navigation/routeForLink';
import { useAuth } from '../../shared/store/useAuthStore';
import { saveBlob } from '../../shared/download';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { TextField } from '../../shared/ui/TextField';
import { s, useAction, useData } from '../inventory/ui';
import { driveApi, type DriveAttachment, type DriveDoc } from './driveApi';
import { AttachmentRow, DocCard } from './DriveCards';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDocuments'>;
const today = () => new Date().toISOString().slice(0, 10);

// 5D shared project drive: standard folders (each with its own access), uploaded documents with versions, comments and
// archive, meeting notes, and every file attached to the project's transactions, each with a link to its source.
export function ProjectDocumentsScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [folder, setFolder] = useState('');
  const [archived, setArchived] = useState(false);
  const fetcher = useCallback(() => driveApi.get(id, folder, archived), [id, folder, archived]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [meeting, setMeeting] = useState({ date: today(), attendees: '', text: '' });
  const back = () => navigation.navigate('ProjectDetail', { id });
  if (error) return <AppScreen title="Project drive" onBack={back}><ErrorState message={error} onRetry={reload} /></AppScreen>;

  const target = folder || 'Other';
  const upload = (forTitle: string, forFolder: string) => run(`up-${forTitle}`, async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const f = new FormData();
    if (Platform.OS === 'web' && a.file) f.append('file', a.file, a.name);
    else f.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    f.append('folder', forFolder);
    f.append('title', forTitle);
    if (note) f.append('note', note);
    await driveApi.upload(id, f);
    setTitle(''); setNote('');
  });
  const download = (d: DriveDoc, version: number) => run(`dl-${d.id}`, async () => { saveBlob(await driveApi.file(id, d.id, version), d.versions[version - 1]?.name || d.title); });
  const downloadAttachment = (a: DriveAttachment) => run(`dl-${a.id}`, async () => { saveBlob(await driveApi.attachment(id, a.id), a.name); });
  const openSource = (a: DriveAttachment) => {
    const t = routeForLink(a.source.link, user);
    if (t) (navigation.navigate as (n: string, p?: object) => void)(t.name, t.params);
  };
  const saveNote = () => run('note', async () => {
    await driveApi.note(id, { title, date: meeting.date, attendees: meeting.attendees.split(',').map((x) => x.trim()).filter(Boolean), text: meeting.text });
    setTitle(''); setMeeting({ date: today(), attendees: '', text: '' });
  });
  const total = (n: { count: number; attachments: number }) => n.count + n.attachments;

  return (
    <AppScreen title="Project drive" subtitle="Every project file in one place: uploads and the files on each transaction" onBack={back} testID="documents-screen">
      {problem ? <ErrorBanner message={problem} testID="doc-problem" /> : null}
      {data ? <ChoiceChips label="Folder" options={[{ value: '', label: 'All' }, ...data.folders.map((x) => ({ value: x.name, label: `${x.name}${total(x) ? ` (${total(x)})` : ''}` }))]} value={folder} onChange={setFolder} testID="doc-folder" /> : null}
      <ChoiceChips label="Show" options={[{ value: 'live', label: 'Current' }, { value: 'archived', label: 'Archived' }]} value={archived ? 'archived' : 'live'} onChange={(v) => setArchived(v === 'archived')} testID="doc-show" />
      {data?.canWrite && !archived && target === 'Meeting notes' ? (
        <View style={s.form} testID="note-form">
          <Text style={s.title}>New meeting note</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Weekly site review" testID="note-title" /></View>
            <View style={s.cell}><TextField label="Date (YYYY-MM-DD)" value={meeting.date} onChangeText={(t) => setMeeting((m) => ({ ...m, date: t }))} testID="note-date" /></View>
          </View>
          <TextField label="Attendees (comma separated)" value={meeting.attendees} onChangeText={(t) => setMeeting((m) => ({ ...m, attendees: t }))} testID="note-attendees" />
          <TextField label="Notes" value={meeting.text} onChangeText={(t) => setMeeting((m) => ({ ...m, text: t }))} multiline testID="note-text" />
          <Button title="Save note" onPress={saveNote} disabled={title.trim().length < 2 || !meeting.text.trim()} loading={busy === 'note'} testID="note-save" />
        </View>
      ) : null}
      {data?.canWrite && !archived && target !== 'Meeting notes' ? (
        <View style={s.form}>
          <Text style={s.title}>Upload to {target}</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. HVAC layout L3" testID="doc-title" /></View>
            <View style={s.cell}><TextField label="Version note" value={note} onChangeText={setNote} placeholder="e.g. R1 after client comments" /></View>
          </View>
          <Button title="Choose file and upload" onPress={() => upload(title, target)} disabled={title.trim().length < 2} loading={busy === `up-${title}`} testID="doc-upload" />
          <Text style={s.muted}>PDF, photos, Excel, Word, DWG/DXF up to 10 MB. The same title in the same folder becomes a new version; older versions stay available.</Text>
        </View>
      ) : null}
      {data?.documents.map((d) => (
        <DocCard key={d.id} d={d} canWrite={data.canWrite} canManage={data.canManage} busy={busy}
          onDownload={download} onNewVersion={(x) => upload(x.title, x.folder)}
          onComment={(x, text) => run(`c-${x.id}`, () => driveApi.comment(id, x.id, text))}
          onArchive={(x, reason) => run(`a-${x.id}`, () => driveApi.archive(id, x.id, reason))}
          onRestore={(x) => run(`r-${x.id}`, () => driveApi.restore(id, x.id))} />
      ))}
      {data?.attachments.length ? <Text style={s.title} testID="att-heading">From transactions ({data.attachments.length})</Text> : null}
      {data?.attachments.map((a) => <AttachmentRow key={a.id} a={a} onOpen={openSource} onDownload={downloadAttachment} />)}
      {data && !data.documents.length && !data.attachments.length ? <Text style={s.muted} testID="drive-empty">Nothing in this folder yet.</Text> : null}
    </AppScreen>
  );
}
