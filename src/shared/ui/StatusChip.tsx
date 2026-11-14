import { StyleSheet, Text, View } from 'react-native';

const TONES = {
  neutral: { bg: '#F1F5F9', fg: '#334155' },
  success: { bg: '#DCFCE7', fg: '#166534' },
  danger: { bg: '#FEE2E2', fg: '#991B1B' },
  info: { bg: '#DBEAFE', fg: '#1E40AF' },
  warning: { bg: '#FEF3C7', fg: '#92400E' },
};

export function StatusChip({ label, tone = 'neutral', testID }: { label: string; tone?: keyof typeof TONES; testID?: string }) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]} testID={testID}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
