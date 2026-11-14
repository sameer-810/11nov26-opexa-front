import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { attendanceApi } from '../api/attendanceApi';
import { CaptureError, currentPosition, takeSelfie } from '../capture';
import { FLAG_LABEL, hm, type Mine, type Today } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Attendance'>;
const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

export function AttendanceScreen({ navigation }: Props) {
  const [today, setToday] = useState<Today | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [placeKey, setPlaceKey] = useState('');
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [t, m] = await Promise.all([attendanceApi.today(), attendanceApi.mine()]);
      setToday(t);
      setMine(m);
      const usable = t.places.filter((p) => p.hasLocation);
      if (usable.length === 1) setPlaceKey(usable[0].projectId ?? 'office');
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));
  // Keep the timer moving while the screen is open.
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const run = async (kind: 'in' | 'out') => {
    setError('');
    setMessage('');
    try {
      const place = today!.places.find((p) => (p.projectId ?? 'office') === placeKey);
      if (kind === 'in' && !place) throw new CaptureError('Choose where you are working today.');
      setStep('Getting your location…');
      const pos = await currentPosition();
      if (pos.mocked) throw new CaptureError('A fake-location app is on. Turn it off to mark attendance.');
      setStep(kind === 'in' ? 'Take a selfie…' : 'Saving…');
      const selfie = kind === 'in' ? await takeSelfie() : null;
      setStep('Saving…');
      const input = { place: (place?.place ?? today!.open?.place ?? 'project') as 'project' | 'office', projectId: place?.projectId, ...pos };
      if (kind === 'in') {
        const r = await attendanceApi.checkIn(input, selfie);
        setMessage(`Checked in at ${r.checkIn.time}${r.project ? ` at ${r.project.name}` : ''}.`);
      } else {
        const r = await attendanceApi.checkOut(input, null);
        setMessage(`Checked out at ${r.checkOut?.time}. Worked ${hm(r.workedMinutes)}.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof CaptureError ? e.message : 'Something went wrong. Check GPS and network and try again.');
    }
    setStep('');
  };

  if (!today) return <AppScreen title="Attendance" onBack={() => navigation.navigate('Dashboard')}>{loadError ? <ErrorState message={loadError} onRetry={load} /> : <ActivityIndicator />}</AppScreen>;

  const open = today.open;
  const shift = today.shiftHours * 60;
  const worked = open ? minutesSince(open.checkIn.at) : 0;
  const busy = Boolean(step);
  return (
    <AppScreen title="Attendance" subtitle={`Today, ${formatDate(today.date)}`} onBack={() => navigation.navigate('Dashboard')} testID="attendance-screen">
      {message ? <Text style={styles.ok} testID="att-message">{message}</Text> : null}
      {open ? (
        <View style={styles.card} testID="att-open">
          <Text style={styles.big} testID="att-timer">{hm(worked)}</Text>
          <Text style={styles.text}>Checked in at {open.checkIn.time} · {open.project ? open.project.name : 'Office'}</Text>
          <View style={styles.bar}><View style={[styles.fill, { width: `${Math.min(100, (worked / shift) * 100)}%` }, worked >= shift && styles.done]} /></View>
          <Text style={styles.muted}>{worked >= shift ? `${today.shiftHours} hours done. Check out when you leave.` : `${hm(shift - worked)} left of the ${today.shiftHours}-hour day`}</Text>
          <Button title="Check out" onPress={() => run('out')} loading={busy} testID="att-check-out" style={styles.self} />
        </View>
      ) : (
        <View style={styles.card}>
          {today.places.length === 0 ? (
            <Text style={styles.text} testID="att-no-places">You are not on any site yet. Ask your manager to add you to a project.</Text>
          ) : (
            <ChoiceChips label="Where are you working today?" value={placeKey} onChange={setPlaceKey} testID="att-place"
              options={today.places.map((p) => ({ value: p.projectId ?? 'office', label: p.hasLocation ? p.name : `${p.name} (no location set)` }))} />
          )}
          <Text style={styles.muted}>You must be at the site. Your GPS position and a selfie are saved with the check-in.</Text>
          <Button title="Check in" onPress={() => run('in')} loading={busy} disabled={!placeKey || !today.places.find((p) => (p.projectId ?? 'office') === placeKey)?.hasLocation} testID="att-check-in" style={styles.self} />
        </View>
      )}
      {step ? <Text style={styles.muted} testID="att-step">{step}</Text> : null}
      {error ? <ErrorBanner message={error} testID="att-error" /> : null}

      {mine ? (
        <>
          <Text style={styles.h2}>This month</Text>
          <Text style={styles.text} testID="att-month">{mine.daysPresent} day{mine.daysPresent === 1 ? '' : 's'} present · {hm(mine.totalMinutes)} worked</Text>
          {mine.records.map((r) => (
            <View key={r.id} style={styles.row} testID={`att-rec-${r.id}`}>
              <Text style={styles.text}>{formatDate(r.date)} · {r.checkIn.time} – {r.checkOut?.time ?? 'now'} · {hm(r.workedMinutes)}</Text>
              <Text style={styles.muted}>{r.project ? r.project.name : 'Office'}{r.flags.length ? ` · ${r.flags.map((f) => FLAG_LABEL[f] ?? f).join(', ')}` : ''}</Text>
            </View>
          ))}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  big: { fontSize: 40, fontWeight: '800', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  ok: { fontSize: 15, color: colors.success, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  row: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6, gap: 2 },
  bar: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.primary },
  done: { backgroundColor: colors.success },
  self: { alignSelf: 'flex-start' },
});
