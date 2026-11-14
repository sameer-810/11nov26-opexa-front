import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { env } from '../../../config/env';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { attendanceApi } from '../api/attendanceApi';
import { currentPosition } from '../capture';
import { FLAG_LABEL, hm, type Office, type TeamDay, type TeamMonth } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamAttendance'>;
const ist = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const shift = (date: string, days: number) => ist(new Date(new Date(`${date}T12:00:00+05:30`).getTime() + days * 86400000));

type Edit = { kind: 'correct'; id: string } | { kind: 'manual'; userId: string; name: string } | null;

export function TeamAttendanceScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState('day');
  const [date, setDate] = useState(route.params?.date ?? ist(new Date()));
  const [day, setDay] = useState<TeamDay | null>(null);
  const [month, setMonth] = useState<TeamMonth | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [edit, setEdit] = useState<Edit>(null);
  const [form, setForm] = useState({ in: '09:00', out: '18:00', reason: '', place: 'office' });
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const canSettings = user?.permissions?.includes('settings.manage') || user?.role === 'owner';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      if (mode === 'day') setDay(await attendanceApi.teamDay(date));
      else setMonth(await attendanceApi.teamMonth(date.slice(0, 7)));
      if (canSettings) setOffice(await attendanceApi.office());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [mode, date, canSettings]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const save = async () => {
    if (!edit) return;
    setError('');
    if (form.reason.trim().length < 3) return setError('Give a reason');
    setBusy(true);
    try {
      if (edit.kind === 'correct') await attendanceApi.correct(edit.id, { checkIn: form.in, checkOut: form.out, reason: form.reason.trim() });
      else await attendanceApi.manual({ userId: edit.userId, place: form.place === 'office' ? 'office' : 'project', projectId: form.place === 'office' ? undefined : form.place, date, checkIn: form.in, checkOut: form.out, reason: form.reason.trim() });
      setEdit(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Something went wrong');
    }
    setBusy(false);
  };

  const setOfficeHere = async () => {
    setError('');
    try {
      const pos = await currentPosition();
      setOffice(await attendanceApi.setOffice({ name: office?.office?.name ?? 'Office', lat: pos.lat, lng: pos.lng, radiusM: office?.office?.radiusM ?? 150 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set the office location');
    }
  };

  const editor = (
    <View style={styles.box} testID="att-edit">
      <Text style={styles.title}>{edit?.kind === 'manual' ? `Add ${edit.name} for ${formatDate(date)}` : 'Correct times'}</Text>
      {edit?.kind === 'manual' && day ? (
        <ChoiceChips label="Where" value={form.place} onChange={(v) => setForm((f) => ({ ...f, place: v }))} testID="att-edit-place"
          options={[{ value: 'office', label: 'Office' }, ...day.projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))]} />
      ) : null}
      <View style={styles.two}>
        <View style={styles.half}><TextField label="In (HH:MM)" value={form.in} onChangeText={(v) => setForm((f) => ({ ...f, in: v }))} testID="att-edit-in" /></View>
        <View style={styles.half}><TextField label="Out (HH:MM)" value={form.out} onChangeText={(v) => setForm((f) => ({ ...f, out: v }))} testID="att-edit-out" /></View>
      </View>
      <TextField label="Reason" value={form.reason} onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))} placeholder="e.g. phone battery died" testID="att-edit-reason" />
      {error ? <ErrorBanner message={error} testID="att-edit-error" /> : null}
      <View style={styles.two}>
        <Button title="Save" onPress={save} loading={busy} testID="att-edit-save" />
        <Button title="Cancel" variant="ghost" onPress={() => setEdit(null)} />
      </View>
    </View>
  );

  return (
    <AppScreen title="Team attendance" subtitle="Who checked in where, with GPS and selfie" onBack={() => navigation.navigate('Dashboard')} testID="team-attendance-screen">
      <ChoiceChips label="View" value={mode} onChange={setMode} testID="att-mode" options={[{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month total' }]} />
      <View style={styles.nav}>
        <Button title="‹" variant="outline" onPress={() => setDate(mode === 'day' ? shift(date, -1) : `${shift(`${date.slice(0, 7)}-01`, -1).slice(0, 7)}-01`)} testID="att-prev" />
        <Text style={styles.title} testID="att-date">{mode === 'day' ? formatDate(date) : date.slice(0, 7)}</Text>
        <Button title="›" variant="outline" onPress={() => setDate(mode === 'day' ? shift(date, 1) : `${shift(`${date.slice(0, 7)}-28`, 5).slice(0, 7)}-01`)} testID="att-next" />
      </View>
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}

      {mode === 'day' && !day && !loadError ? <ActivityIndicator /> : null}
      {mode === 'day' && day ? (
        <>
          <Text style={styles.muted}>{day.records.length} present · {day.absent.length} not checked in</Text>
          {day.records.map((r) => (
            <View key={r.id} style={styles.card} testID={`att-team-${r.user.name}`}>
              <View style={styles.rowTop}>
                {r.checkIn.photoUrl ? <Image source={{ uri: env.apiUrl + r.checkIn.photoUrl }} style={styles.photo} accessibilityLabel={`Selfie of ${r.user.name}`} /> : <View style={[styles.photo, styles.noPhoto]} />}
                <View style={styles.flex}>
                  <Text style={styles.title}>{r.user.name}</Text>
                  <Text style={styles.text}>{r.checkIn.time} – {r.checkOut?.time ?? 'still in'} · {hm(r.workedMinutes)}</Text>
                  <Text style={styles.muted}>{r.project ? `${r.project.code} ${r.project.name}` : 'Office'}{r.checkIn.distanceM != null ? ` · ${r.checkIn.distanceM} m from centre` : ''}</Text>
                  {r.flags.length ? <Text style={styles.flag}>{r.flags.map((f) => FLAG_LABEL[f] ?? f).join(' · ')}{r.correctionReason ? ` - ${r.correctionReason}` : ''}</Text> : null}
                </View>
              </View>
              <Pressable onPress={() => { setEdit({ kind: 'correct', id: r.id }); setForm({ in: r.checkIn.time, out: r.checkOut?.time ?? '18:00', reason: '', place: 'office' }); setError(''); }} testID={`att-correct-${r.user.name}`}>
                <Text style={styles.link}>Correct times</Text>
              </Pressable>
              {edit?.kind === 'correct' && edit.id === r.id ? editor : null}
            </View>
          ))}
          {day.absent.length ? <Text style={styles.h2}>Not checked in</Text> : null}
          {day.absent.map((u) => (
            <View key={u.id} style={styles.absent} testID={`att-absent-${u.name}`}>
              <Text style={styles.text}>{u.name}</Text>
              <Pressable onPress={() => { setEdit({ kind: 'manual', userId: u.id, name: u.name }); setForm({ in: '09:00', out: '18:00', reason: '', place: 'office' }); setError(''); }} testID={`att-add-${u.name}`}>
                <Text style={styles.link}>Add missed day</Text>
              </Pressable>
              {edit?.kind === 'manual' && edit.userId === u.id ? editor : null}
            </View>
          ))}
        </>
      ) : null}

      {mode === 'month' && month ? (
        <View testID="att-month-table">
          {month.people.map((p) => (
            <View key={p.user.id} style={styles.absent} testID={`att-month-${p.user.name}`}>
              <Text style={styles.title}>{p.user.name}</Text>
              <Text style={styles.text}>{p.daysPresent} days · {hm(p.totalMinutes)}{p.flagged ? ` · ${p.flagged} to check` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {canSettings && office ? (
        <View style={styles.box} testID="att-office">
          <Text style={styles.title}>Office location</Text>
          <Text style={styles.muted}>{office.office ? `${office.office.name}: ${office.office.lat.toFixed(5)}, ${office.office.lng.toFixed(5)} (within ${office.office.radiusM} m)` : 'Not set. Office and store staff cannot check in until it is set.'}</Text>
          <Button title="Use my current location as the office" variant="outline" onPress={setOfficeHere} testID="att-set-office" style={styles.self} />
          {error && !edit ? <ErrorBanner message={error} /> : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceAlt },
  rowTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt },
  noPhoto: { borderWidth: 1, borderColor: colors.border },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  flag: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  link: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  absent: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, gap: 4 },
  two: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 120 },
  self: { alignSelf: 'flex-start' },
});
