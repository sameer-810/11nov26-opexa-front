import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../designSystem';

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
});
