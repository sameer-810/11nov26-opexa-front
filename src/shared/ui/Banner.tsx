import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../designSystem';

export function ErrorBanner({ message, testID }: { message: string; testID?: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert" testID={testID}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  text: { color: colors.danger, fontSize: 14 },
});
