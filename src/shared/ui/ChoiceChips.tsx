import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../designSystem';

type Option = { value: string; label: string; hint?: string };
type Props = { label: string; options: Option[]; value: string; onChange: (v: string) => void; error?: string; testID?: string };

// A row of tappable options; one can be selected.
export function ChoiceChips({ label, options, value, onChange, error, testID }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={testID ? `${testID}-${o.value}` : undefined}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={[styles.chipText, selected && styles.selectedText]}>{o.label}</Text>
              {o.hint ? <Text style={[styles.hint, selected && styles.selectedHint]}>{o.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, maxWidth: 240 },
  selected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  selectedText: { color: colors.primaryDark },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  selectedHint: { color: colors.primaryDark },
  error: { fontSize: 13, color: colors.danger },
});
