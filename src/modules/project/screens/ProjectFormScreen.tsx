import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { colors, spacing } from '../../../shared/designSystem';
import { projectApi } from '../api/projectApi';
import { BOQ_FORMAT_LABEL, STATUS_LABEL, type AssignableUser, type BoqFormat, type ProjectStatus } from '../types';
import { validateProjectForm, type ProjectForm, type ProjectFormErrors } from '../project.validation';

type Props = NativeStackScreenProps<RootStackParamList, 'NewProject' | 'EditProject'>;

const empty: ProjectForm = { name: '', clientName: '', siteAddress: '', clientPoNumber: '', lat: '', lng: '', geofenceRadiusM: '200' };

export function ProjectFormScreen({ navigation, route }: Props) {
  const id = (route.params as { id?: string } | undefined)?.id;
  const [form, setForm] = useState<ProjectForm>(empty);
  const [status, setStatus] = useState<ProjectStatus>('active');
  // 1A.2: the project manager, chosen from people who can manage projects ('' = none).
  const [managerId, setManagerId] = useState('');
  const [managers, setManagers] = useState<AssignableUser[]>([]);
  // Q18: chosen at creation; changeable until the BOQ is locked.
  const [boqFormat, setBoqFormat] = useState<BoqFormat>('sitc');
  const [boqLocked, setBoqLocked] = useState(false);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    projectApi.assignableUsers().then((u) => setManagers(u.filter((x) => x.canManage))).catch(() => setManagers([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    projectApi
      .get(id)
      .then((p) => {
        setForm({
          name: p.name,
          clientName: p.clientName,
          siteAddress: p.siteAddress ?? '',
          clientPoNumber: p.clientPoNumber ?? '',
          lat: p.location ? String(p.location.lat) : '',
          lng: p.location ? String(p.location.lng) : '',
          geofenceRadiusM: String(p.geofenceRadiusM),
        });
        setStatus(p.status);
        setManagerId(p.projectManagerId ?? '');
        setBoqFormat(p.boqFormat ?? 'sitc');
        setBoqLocked(Boolean(p.boqLocked));
      })
      .catch((e) => setFormError(e instanceof ApiError ? e.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: keyof ProjectForm) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const useMyLocation = async () => {
    setFormError('');
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location permission was not given');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
      setErrors((e) => ({ ...e, lat: undefined, lng: undefined }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setFormError('');
    const found = validateProjectForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const lat = parseNumber(form.lat);
    const lng = parseNumber(form.lng);
    const body = {
      name: form.name.trim(),
      clientName: form.clientName.trim(),
      siteAddress: form.siteAddress.trim(),
      clientPoNumber: form.clientPoNumber.trim(),
      location: lat !== null && lng !== null ? { lat, lng } : null,
      geofenceRadiusM: parseNumber(form.geofenceRadiusM) ?? 200,
      projectManagerId: managerId || null,
      ...(boqLocked ? {} : { boqFormat }),
    };
    setBusy(true);
    try {
      const saved = id ? await projectApi.update(id, { ...body, status }) : await projectApi.create(body);
      navigation.replace('ProjectDetail', { id: saved.id });
    } catch (e) {
      if (e instanceof ApiError) {
        const fe: ProjectFormErrors = {};
        e.details.forEach((d) => {
          fe[d.field as keyof ProjectFormErrors] = d.message;
        });
        setErrors(fe);
        // e.g. "Finish open material work before closing: 1 lot(s) not checked in"
        setFormError(e.code === 'OPEN_MATERIAL' ? `${e.message}: ${e.details.map((d) => d.message).join(', ')}` : e.message);
      } else setFormError('Something went wrong');
      setBusy(false);
    }
  };

  if (loading) return <AppScreen title="Edit project" onBack={() => navigation.goBack()}><ActivityIndicator /></AppScreen>;

  return (
    <AppScreen title={id ? 'Edit project' : 'New project'} onBack={() => navigation.goBack()} testID="project-form-screen">
      <View style={styles.form}>
        {formError ? <ErrorBanner message={formError} testID="project-form-error" /> : null}
        <TextField label="Project name" testID="pf-name" value={form.name} onChangeText={set('name')} error={errors.name} placeholder="e.g. Worli Tower HVAC" />
        <TextField label="Client name" testID="pf-client" value={form.clientName} onChangeText={set('clientName')} error={errors.clientName} />
        <TextField label="Site address" testID="pf-address" value={form.siteAddress} onChangeText={set('siteAddress')} />
        <TextField label="Client PO number" testID="pf-po" value={form.clientPoNumber} onChangeText={set('clientPoNumber')} />
        <ChoiceChips
          label="Project manager"
          testID="pf-pm"
          value={managerId}
          onChange={setManagerId}
          error={errors.projectManagerId}
          options={[{ value: '', label: 'Not set' }, ...managers.map((m) => ({ value: m.id, label: m.name }))]}
        />
        {boqLocked ? (
          <Text style={styles.muted} testID="pf-boq-format-locked">BOQ format: {BOQ_FORMAT_LABEL[boqFormat]} (fixed, the BOQ is locked)</Text>
        ) : (
          <ChoiceChips
            label="BOQ format"
            testID="pf-boq-format"
            value={boqFormat}
            onChange={(v) => setBoqFormat(v as BoqFormat)}
            options={(['sitc', 'supply_installation'] as const).map((f) => ({ value: f, label: BOQ_FORMAT_LABEL[f], hint: f === 'sitc' ? 'One rate per line' : 'Separate supply and installation rates' }))}
          />
        )}
        {id ? (
          <ChoiceChips
            label="Status"
            testID="pf-status"
            value={status}
            onChange={(v) => setStatus(v as ProjectStatus)}
            options={(['active', 'closing', 'closed'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        ) : null}
        <Text style={styles.section}>Site location</Text>
        <Text style={styles.muted}>Used for attendance: staff can check in only within this distance of the site.</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Latitude" testID="pf-lat" value={form.lat} onChangeText={set('lat')} error={errors.lat} keyboardType="numbers-and-punctuation" placeholder="19.017600" />
          </View>
          <View style={styles.flex}>
            <TextField label="Longitude" testID="pf-lng" value={form.lng} onChangeText={set('lng')} error={errors.lng} keyboardType="numbers-and-punctuation" placeholder="72.817200" />
          </View>
        </View>
        <Button title="Use my current location" variant="outline" onPress={useMyLocation} loading={locating} testID="pf-locate" />
        <TextField label="Check-in distance (metres)" testID="pf-radius" value={form.geofenceRadiusM} onChangeText={set('geofenceRadiusM')} error={errors.geofenceRadiusM} keyboardType="number-pad" />
        <Button title={id ? 'Save changes' : 'Create project'} onPress={submit} loading={busy} testID="pf-submit" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, maxWidth: 640 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 200 },
});
