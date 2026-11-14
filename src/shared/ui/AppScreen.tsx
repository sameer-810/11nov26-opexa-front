import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OfflineBar } from './OfflineBar';
import { colors, maxContentWidth, spacing } from '../designSystem';

type Props = { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; testID?: string; hideOfflineBar?: boolean };

// Standard page inside the signed-in app: back link, title, content.
export function AppScreen({ title, subtitle, onBack, right, children, testID, hideOfflineBar }: Props) {
  const navigation = useNavigation();
  return (
    <ScrollView contentContainerStyle={styles.page} testID={testID} keyboardShouldPersistTaps="handled">
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="link" testID="back">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      ) : null}
      {hideOfflineBar ? null : <OfflineBar onOpenOutbox={() => (navigation.navigate as (n: string) => void)('Outbox')} />}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  back: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  flex: { flexShrink: 1 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
});
