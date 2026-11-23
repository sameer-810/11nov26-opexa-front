import { Platform, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { saveBlob } from '../../../shared/download';
import { Button } from '../../../shared/ui/Button';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { PickedFile } from '../api/requisitionApi';
import type { Attachment } from '../types';

const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const kb = (size: number) => `${Math.max(1, Math.ceil(size / 1024))} KB`;

// Opens the file picker for one photo or PDF; null if the user cancels.
export async function pickAttachment(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { name: a.name, file: Platform.OS === 'web' && a.file ? a.file : { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } };
}

type FormProps = { picked: PickedFile[]; onPick: (v: PickedFile[]) => void; existing?: Attachment[]; onRemoveExisting?: (a: Attachment) => void };

// Form part: files already on the request (edit) plus new ones, uploaded after the request is saved.
export function AttachmentPicker({ picked, onPick, existing = [], onRemoveExisting }: FormProps) {
  const add = async () => {
    const f = await pickAttachment();
    if (f) onPick([...picked, f]);
  };
  return (
    <View style={styles.box} testID="req-attachments">
      <Text style={styles.title}>Attachments (photos or PDF, up to 5 MB each)</Text>
      {existing.map((a) => (
        <View key={a.id} style={styles.row}>
          <Text style={styles.text}>{a.name} · {kb(a.size)}</Text>
          {onRemoveExisting ? <Button title="Remove" variant="ghost" onPress={() => onRemoveExisting(a)} testID={`req-att-remove-${a.name}`} /> : null}
        </View>
      ))}
      {picked.map((p, i) => (
        <View key={`${p.name}-${i}`} style={styles.row}>
          <Text style={styles.text}>{p.name} (to upload)</Text>
          <Button title="Remove" variant="ghost" onPress={() => onPick(picked.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button title="Attach photo or PDF" variant="outline" onPress={add} testID="req-attach" style={styles.self} />
    </View>
  );
}

// Detail part: download each attachment (`fetchFile` fetches one; material requests, challans and returns use it).
export function AttachmentList({ items, onError, fetchFile }: { items: Attachment[]; onError: (m: string) => void; fetchFile: (a: Attachment) => Promise<Blob> }) {
  if (!items.length) return null;
  const download = async (a: Attachment) => {
    try {
      if (!saveBlob(await fetchFile(a), a.name)) onError('Open this on the web to download attachments.');
    } catch {
      onError('Could not download the file');
    }
  };
  return (
    <View style={styles.box} testID="req-attachment-list">
      <Text style={styles.title}>Attachments ({items.length})</Text>
      {items.map((a) => (
        <View key={a.id} style={styles.row}>
          <Text style={styles.text}>{a.name} · {kb(a.size)}</Text>
          <Button title="Download" variant="ghost" onPress={() => download(a)} testID={`req-att-${a.name}`} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text, flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  self: { alignSelf: 'flex-start' },
});
