import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { Button } from '../../../shared/ui/Button';
import { colors, maxContentWidth, radius, spacing } from '../../../shared/designSystem';
import { features, steps } from '../content';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export function LandingScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  return (
    <ScrollView contentContainerStyle={styles.page} testID="landing-screen">
      <View style={[styles.container, styles.header]}>
        <Text style={styles.logo} accessibilityRole="header">Opexa</Text>
        <View style={styles.row}>
          <Button title="Sign in" variant="ghost" onPress={() => navigation.navigate('SignIn')} testID="header-signin" />
          <Button title="Get started" onPress={() => navigation.navigate('SignUp')} testID="header-signup" />
        </View>
      </View>

      <View style={[styles.container, styles.hero]}>
        <Text style={[styles.heroTitle, wide && styles.heroTitleWide]} accessibilityRole="header">
          Run every HVAC site from one app
        </Text>
        <Text style={styles.heroBody}>
          Material requests, deliveries, work orders, site attendance and billing for turnkey HVAC projects, in one place
          instead of WhatsApp lists and Excel sheets.
        </Text>
        <View style={styles.row}>
          <Button title="Create your company account" onPress={() => navigation.navigate('SignUp')} testID="hero-signup" />
          <Button title="Sign in" variant="outline" onPress={() => navigation.navigate('SignIn')} testID="hero-signin" />
        </View>
      </View>

      <View style={[styles.container, styles.grid, wide && styles.gridWide]}>
        {features.map((f) => (
          <View key={f.title} style={[styles.card, wide && styles.cardWide]}>
            <Text style={styles.cardTitle}>{f.title}</Text>
            <Text style={styles.cardBody}>{f.body}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.container, styles.section]}>
        <Text style={styles.sectionTitle} accessibilityRole="header">How it works</Text>
        {steps.map((s, i) => (
          <Text key={s} style={styles.step}>{`${i + 1}. ${s}`}</Text>
        ))}
      </View>

      <View style={[styles.container, styles.footer]}>
        <Text style={styles.footerText}>© {new Date().getFullYear()} Opexa</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.surface, paddingBottom: spacing.xl },
  container: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  hero: { paddingVertical: spacing.xxl, gap: spacing.lg },
  heroTitle: { fontSize: 34, fontWeight: '800', color: colors.text, lineHeight: 42 },
  heroTitleWide: { fontSize: 48, lineHeight: 58, maxWidth: 760 },
  heroBody: { fontSize: 18, color: colors.textMuted, lineHeight: 28, maxWidth: 680 },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardWide: { width: '48.5%' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  section: { paddingVertical: spacing.xl, gap: spacing.sm },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  step: { fontSize: 16, color: colors.text, lineHeight: 26 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  footerText: { color: colors.textMuted, fontSize: 13 },
});
