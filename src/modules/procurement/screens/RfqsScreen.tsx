import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDateTime } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { procurementApi } from '../api/procurementApi';
import { RFQ_TONE, label } from '../types';
import { Loading, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Rfqs'>;
const FILTERS = [{ value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'closed', label: 'Closed' }, { value: 'cancelled', label: 'Cancelled' }];

export function RfqsScreen({ navigation }: Props) {
  const [status, setStatus] = useState('');
  const fetcher = useCallback(() => procurementApi.rfqs({ status }), [status]);
  const { data, error, reload } = useLoad(fetcher);
  return (
    <AppScreen title="RFQs" subtitle="Raise an RFQ from an approved material request (open the request → Request quotations)" onBack={() => navigation.navigate('Procurement')} testID="rfqs-screen">
      <ChoiceChips label="Status" options={FILTERS} value={status} onChange={setStatus} />
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {data?.length === 0 ? <EmptyState title="No RFQs" body="Open an approved material request and choose 'Request quotations'." /> : null}
      <View style={styles.list}>
        {data?.map((r) => (
          <Pressable key={r.id} accessibilityRole="button" onPress={() => navigation.navigate('RfqDetail', { id: r.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} testID={`rfq-${r.number}`}>
            <View style={styles.row}><Text style={styles.number}>{r.number}</Text><StatusChip label={label(r.status)} tone={RFQ_TONE[r.status]} /></View>
            <Text style={styles.title}>{r.lines.length} item(s) · {r.suppliers.length} supplier(s)</Text>
            <Text style={styles.muted}>Quoted {r.quotedCount ?? 0} · awaiting {r.pendingCount ?? 0} · deadline {formatDateTime(r.deadline)}{r.deadlinePassed && r.status === 'sent' ? ' (passed)' : ''}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
