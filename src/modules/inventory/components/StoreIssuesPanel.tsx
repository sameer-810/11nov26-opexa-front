import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatNumber } from '../../../shared/format';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { inventoryApi } from '../api/inventoryApi';
import { s, useData } from '../ui';
import { HandoverActions } from './HandoverActions';

const LABEL: Record<string, string> = { dispatched: 'On the way', partially_received: 'Partly received', received: 'Received', discrepancy: 'Discrepancy pending', closed: 'Closed' };
const TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'danger'> = { dispatched: 'info', partially_received: 'warning', received: 'success', discrepancy: 'danger', closed: 'neutral' };

// Workflow Phase D: material issued from the store to this site; the named engineer confirms it here.
export function StoreIssuesPanel({ projectId }: { projectId: string }) {
  const fetcher = useCallback(() => inventoryApi.transfers({ projectId, status: 'dispatched,partially_received,discrepancy,received,closed' }), [projectId]);
  const { data, reload } = useData(fetcher);
  if (!data?.length) return null;
  return (
    <View style={s.list} testID="store-issues">
      <Text style={s.title}>Material from store</Text>
      {data.map((t) => (
        <View key={t.id} style={s.card} testID={`store-issue-${t.issueNo || t.number}`}>
          <View style={s.row}><Text style={s.number}>{t.issueNo || t.number}</Text><StatusChip label={LABEL[t.status] ?? t.status} tone={TONE[t.status] ?? 'neutral'} /></View>
          <Text style={s.muted}>{t.dispatchedAt ? `Sent ${formatDate(t.dispatchedAt)}` : ''}{t.gatePassNo ? ` · gate pass ${t.gatePassNo}` : ''}</Text>
          {t.lines.map((l) => <Text key={l.id} style={s.muted}>{l.name}: issued {formatNumber(l.qtyDispatched)} · accepted {formatNumber(l.qtyReceived)} {l.unit}</Text>)}
          <HandoverActions t={t} onDone={() => void reload()} />
        </View>
      ))}
    </View>
  );
}
