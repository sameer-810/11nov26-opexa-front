import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { s, useAction } from '../../inventory/ui';
import { vendorApi } from '../api/vendorApi';

// Upload a supplier document (GST certificate, trade licence…) with an optional expiry date.
export function VendorDocumentUpload({ vendorId, onUploaded }: { vendorId: string; onUploaded: () => void }) {
  const [label, setLabel] = useState('');
  const [until, setUntil] = useState('');
  const { busy, problem, run } = useAction(() => { setLabel(''); setUntil(''); onUploaded(); });
  const pick = () => run('doc', async () => {
    if (until.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(until.trim())) throw new Error('Enter the expiry as YYYY-MM-DD');
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await vendorApi.addDocument(vendorId, { uri: a.uri, name: a.name, mimeType: a.mimeType, file: Platform.OS === 'web' ? a.file : undefined }, label.trim(), until.trim());
  });
  return (
    <View style={s.list}>
      {problem ? <ErrorBanner message={problem} testID="vendor-doc-problem" /> : null}
      <View style={s.row}>
        <View style={s.cell}><TextField label="Document name" value={label} onChangeText={setLabel} placeholder="e.g. Trade licence" testID="vendor-doc-label" /></View>
        <View style={s.cell}><TextField label="Valid until (YYYY-MM-DD, optional)" value={until} onChangeText={setUntil} testID="vendor-doc-until" /></View>
        <Button title="Upload document" variant="outline" onPress={pick} loading={busy === 'doc'} testID="vendor-doc-upload" />
      </View>
    </View>
  );
}
