import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { formatDateTime } from '../../../shared/format';
import { s, useData } from '../../inventory/ui';
import { activityApi, actionLabel, fieldLabel, type AuditValue } from '../../activity/activityApi';

const show = (v: AuditValue) => (v === null || v === '' ? '—' : String(v));

// Every change to one BOQ line: previous and new value, who, when, and the revision or reason it came with.
export function BoqLineHistory({ itemId }: { itemId: string }) {
  const fetcher = useCallback(() => activityApi.forEntity('boq_item', itemId), [itemId]);
  const { data, error } = useData(fetcher);
  if (error) return <Text style={s.danger}>{error}</Text>;
  if (!data) return null;
  return (
    <View style={s.list} testID="boq-line-history">
      {data.length ? [...data].reverse().map((e) => (
        <View key={e.id}>
          <Text style={s.muted}>{formatDateTime(e.at)} · {actionLabel(e.action)} · {e.user?.name ?? 'System'}{e.remarks ? ` · ${e.remarks}` : ''}</Text>
          {e.changes.map((c) => <Text key={c.field} style={s.muted}>   {fieldLabel(c.field)}: {show(c.old)} → {show(c.new)}</Text>)}
        </View>
      )) : <Text style={s.muted}>No changes recorded yet.</Text>}
    </View>
  );
}
