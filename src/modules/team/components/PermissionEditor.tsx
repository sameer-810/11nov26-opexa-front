import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../shared/designSystem';
import type { PermissionInfo } from '../types';

type Props = { catalog: PermissionInfo[]; value: string[]; onChange: (next: string[]) => void; disabled?: boolean };

// Grouped on/off switches, one per permission.
export function PermissionEditor({ catalog, value, onChange, disabled }: Props) {
  const groups = [...new Set(catalog.map((p) => p.group))];
  const toggle = (key: string, on: boolean) => onChange(on ? [...new Set([...value, key])] : value.filter((k) => k !== key));

  return (
    <View style={styles.wrap} testID="permission-editor">
      {groups.map((g) => (
        <View key={g} style={styles.group}>
          <Text style={styles.groupTitle}>{g}</Text>
          {catalog
            .filter((p) => p.group === g)
            .map((p) => (
              <View key={p.key} style={styles.row}>
                <Text style={styles.label}>{p.label}</Text>
                <Switch
                  value={value.includes(p.key)}
                  onValueChange={(on) => toggle(p.key, on)}
                  disabled={disabled}
                  accessibilityLabel={p.label}
                  testID={`perm-${p.key}`}
                />
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  group: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 36 },
  label: { fontSize: 15, color: colors.text, flexShrink: 1 },
});
