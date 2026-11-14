import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { saveBlob } from '../../../shared/download';
import { formatMoney, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../api/projectApi';
import type { ImportResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BoqImport'>;
type Picked = DocumentPicker.DocumentPickerAsset;

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function toForm(file: Picked): FormData {
  const form = new FormData();
  if (Platform.OS === 'web' && file.file) form.append('file', file.file, file.name);
  else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? XLSX } as unknown as Blob);
  return form;
}

export function BoqImportScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [file, setFile] = useState<Picked | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'check' | 'import' | 'template'>('');

  const pick = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ type: [XLSX], copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const f = res.assets[0];
    setFile(f);
    setPreview(null);
    setBusy('check');
    try {
      setPreview(await projectApi.importBoq(id, toForm(f), true));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not read the file');
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    if (!file) return;
    setError('');
    setBusy('import');
    try {
      await projectApi.importBoq(id, toForm(file), false);
      navigation.navigate('ProjectDetail', { id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Import failed');
      setBusy('');
    }
  };

  const downloadTemplate = async () => {
    setError('');
    setBusy('template');
    try {
      const blob = await projectApi.template();
      if (!saveBlob(blob, 'opexa-boq-template.xlsx')) setError('Download the template from the web app on a computer.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Download failed');
    } finally {
      setBusy('');
    }
  };

  const total = preview?.rows.reduce((s, r) => s + (r.quantity ?? 0) * (r.rate ?? 0), 0) ?? 0;

  return (
    <AppScreen title="Import BOQ from Excel" subtitle="Rows are checked first. Nothing is saved until you confirm." onBack={() => navigation.navigate('ProjectDetail', { id })} testID="boq-import-screen">
      <View style={styles.steps}>
        <Text style={styles.step}>1. The first sheet needs columns: S.No, Description, Unit, Qty, Rate (headings can be in any of the first 15 rows).</Text>
        <Text style={styles.step}>2. Choose the .xlsx file. Each row is checked and problems are shown below.</Text>
        <Text style={styles.step}>3. If every row is fine, confirm the import.</Text>
      </View>
      <View style={styles.row}>
        <Button title="Download template" variant="ghost" onPress={downloadTemplate} loading={busy === 'template'} testID="download-template" />
        <Button title={file ? 'Choose a different file' : 'Choose Excel file'} variant="outline" onPress={pick} loading={busy === 'check'} testID="choose-file" />
      </View>
      {file ? <Text style={styles.muted} testID="chosen-file">File: {file.name}</Text> : null}
      {error ? <ErrorBanner message={error} testID="import-error" /> : null}

      {preview ? (
        <View style={styles.gap}>
          <Text style={[styles.summary, preview.errorCount ? styles.bad : styles.good]} testID="import-summary">
            {preview.errorCount
              ? `${preview.errorCount} of ${preview.rows.length} rows have problems. Fix them in Excel and choose the file again.`
              : `All ${preview.rows.length} rows are fine · Total ${formatMoney(total)}`}
          </Text>
          <ScrollView horizontal>
            <View style={styles.table}>
              <View style={[styles.tr, styles.head]}>
                {['Row', 'S.No', 'Description', 'Unit', 'Qty', 'Rate', 'Problem'].map((h, i) => (
                  <Text key={h} style={[styles.th, { width: [50, 60, 260, 60, 80, 100, 260][i] }]}>{h}</Text>
                ))}
              </View>
              {preview.rows.map((r) => (
                <View key={r.row} style={[styles.tr, r.errors.length ? styles.errRow : null]} testID={`import-row-${r.row}`}>
                  <Text style={[styles.td, { width: 50 }]}>{r.row}</Text>
                  <Text style={[styles.td, { width: 60 }]}>{r.serialNo}</Text>
                  <Text style={[styles.td, { width: 260 }]} numberOfLines={2}>{r.description}</Text>
                  <Text style={[styles.td, { width: 60 }]}>{r.unit}</Text>
                  <Text style={[styles.td, { width: 80 }]}>{r.quantity === null ? '—' : formatNumber(r.quantity)}</Text>
                  <Text style={[styles.td, { width: 100 }]}>{r.rate === null ? '—' : formatMoney(r.rate)}</Text>
                  <Text style={[styles.td, styles.problem, { width: 260 }]}>{r.errors.join('; ')}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {preview.errorCount === 0 ? (
            <Button title={`Import ${preview.rows.length} items`} onPress={confirm} loading={busy === 'import'} testID="confirm-import" style={styles.self} />
          ) : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 4, backgroundColor: colors.surfaceAlt, padding: spacing.md, borderRadius: radius.md },
  step: { fontSize: 14, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  muted: { fontSize: 14, color: colors.textMuted },
  gap: { gap: spacing.md },
  summary: { fontSize: 15, fontWeight: '700', padding: spacing.md, borderRadius: radius.md },
  good: { backgroundColor: '#ECFDF5', color: '#065F46' },
  bad: { backgroundColor: '#FEF2F2', color: colors.danger },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { backgroundColor: colors.surfaceAlt },
  errRow: { backgroundColor: '#FEF2F2' },
  th: { fontSize: 13, fontWeight: '700', padding: 8, color: colors.text },
  td: { fontSize: 13, padding: 8, color: colors.text },
  problem: { color: colors.danger },
  self: { alignSelf: 'flex-start' },
});
