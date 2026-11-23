import { useCallback } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { formatDate, formatMoney } from '../../../shared/format';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { inventoryApi } from '../api/inventoryApi';
import { s, useData } from '../ui';

const ACTION: Record<string, string> = {
  issued: 'Issued', returned: 'Returned', condition: 'Condition changed', missing: 'Lost / missing', damaged: 'Damaged', scrapped: 'Scrapped',
  repair_sent: 'Sent for repair', repaired: 'Repaired', maintenance: 'Maintenance',
};
const label = (v: string) => v.replace(/_/g, ' ');

// A tool's history: issues and returns with conditions, lost / damaged with responsibility, repairs and services.
export function ToolHistoryPanel({ id }: { id: string }) {
  const fetcher = useCallback(() => inventoryApi.tool(id), [id]);
  const { data, error, reload } = useData(fetcher);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ActivityIndicator />;
  return (
    <View style={s.form} testID="tool-history">
      {data.nextServiceDue ? <Text style={data.serviceDue ? s.warn : s.muted}>Next service due {formatDate(data.nextServiceDue)}</Text> : null}
      <Text style={s.title}>Maintenance</Text>
      {data.maintenance.length === 0 ? <Text style={s.muted}>No repairs or services recorded.</Text> : null}
      {data.maintenance.map((m) => (
        <Text key={m.id} style={s.muted} testID={`tool-maint-${m.id}`}>
          {formatDate(m.date)} · {label(m.type)}{m.status === 'open' ? ' (away)' : ''}{m.vendor ? ` · ${m.vendor}` : ''} · {formatMoney(m.cost)} · {m.project ?? 'Office'}{m.notes ? ` · ${m.notes}` : ''}{m.nextDueDate ? ` · next due ${formatDate(m.nextDueDate)}` : ''}
        </Text>
      ))}
      <Text style={s.title}>Movements</Text>
      {data.history.map((h, i) => (
        <Text key={`${h.date}-${i}`} style={s.muted}>
          {formatDate(h.date)} · {ACTION[h.action] ?? h.action}{h.holderName ? ` · ${h.holderName}` : ''}{h.project ? ` · ${h.project}` : ''}{h.condition ? ` · ${label(h.condition)}` : ''}
          {h.responsible ? ` · responsible ${h.responsible.name}` : ''}{h.recoveryAmount ? ` · recover ${formatMoney(h.recoveryAmount)}` : ''}{h.note ? ` · ${h.note}` : ''}{h.by ? ` (${h.by})` : ''}
        </Text>
      ))}
    </View>
  );
}
