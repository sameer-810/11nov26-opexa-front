import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNetState } from '../offline/connectivity';
import { flushOutbox } from '../offline/outbox';
import { colors, radius, spacing } from '../designSystem';

// Shown at the top of every signed-in screen when something about the network matters.
export function OfflineBar({ onOpenOutbox }: { onOpenOutbox?: () => void }) {
  const s = useNetState();
  if (s.online && !s.showingSaved && !s.pending && !s.failed) return null;
  return (
    <View style={styles.wrap} testID="offline-bar">
      {!s.online || s.showingSaved ? (
        <Text style={styles.text} testID="offline-status">
          {s.online ? 'Showing saved data.' : 'You are offline.'} {s.showingSaved ? 'This screen shows what was saved on this device.' : ''}
        </Text>
      ) : null}
      {s.pending ? (
        <View style={styles.row}>
          <Text style={styles.text} testID="offline-pending">{s.pending} change{s.pending === 1 ? '' : 's'} saved on this device, waiting to send{s.syncing ? ' (sending…)' : ''}.</Text>
          <Pressable onPress={() => flushOutbox()} testID="offline-send-now"><Text style={styles.link}>Send now</Text></Pressable>
        </View>
      ) : null}
      {s.failed ? (
        <View style={styles.row}>
          <Text style={[styles.text, styles.bad]} testID="offline-failed">{s.failed} change{s.failed === 1 ? '' : 's'} could not be sent.</Text>
          {onOpenOutbox ? <Pressable onPress={onOpenOutbox} testID="offline-open-outbox"><Text style={styles.link}>See why</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  text: { fontSize: 13, color: colors.text, flexShrink: 1 },
  bad: { color: colors.danger },
  link: { fontSize: 13, color: colors.primary, fontWeight: '700' },
});
