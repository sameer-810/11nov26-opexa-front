import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../shared/designSystem';
import { discard, flushOutbox, listOutbox, type OutboxItem } from '../../shared/offline/outbox';
import { useNetState } from '../../shared/offline/connectivity';

type Props = NativeStackScreenProps<RootStackParamList, 'Outbox'>;

// Changes made without network: waiting ones, and ones the server refused.
export function OutboxScreen({ navigation }: Props) {
  const net = useNetState();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const load = useCallback(async () => setItems(await listOutbox()), []);
  useFocusEffect(useCallback(() => void load(), [load, net.pending, net.failed])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppScreen title="Saved on this device" subtitle="Changes made without network" onBack={() => navigation.navigate('Dashboard')} testID="outbox-screen" hideOfflineBar>
      {items.some((i) => i.status === 'pending') ? <Button title="Send now" onPress={async () => { await flushOutbox(); load(); }} loading={net.syncing} testID="outbox-send" style={styles.self} /> : null}
      {items.length === 0 ? <EmptyState title="Nothing waiting" body="Everything has been sent." /> : null}
      {items.map((i) => (
        <View key={i.id} style={[styles.card, i.status === 'failed' && styles.failed]} testID={`outbox-${i.status}`}>
          <Text style={styles.title}>{i.label}</Text>
          <Text style={styles.muted}>Made {formatDateTime(i.createdAt)} · {i.status === 'pending' ? 'waiting to send' : 'not accepted'}</Text>
          {i.error ? <Text style={styles.err} testID="outbox-error">{i.error}</Text> : null}
          {i.status === 'failed' ? (
            <Button title="Remove" variant="outline" onPress={async () => { await discard(i.id); load(); }} testID="outbox-discard" style={styles.self} />
          ) : null}
        </View>
      ))}
      <Text style={styles.muted}>A change that was not accepted (for example, the stock had already been used) is not applied. Remove it and enter it again if still needed.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  failed: { borderColor: colors.danger },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  err: { fontSize: 14, color: colors.danger },
});
