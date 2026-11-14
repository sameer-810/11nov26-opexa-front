import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, spacing } from '../designSystem';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.box} testID="error-state">
      <Text style={styles.text}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  text: { color: colors.danger, fontSize: 15, textAlign: 'center' },
});
