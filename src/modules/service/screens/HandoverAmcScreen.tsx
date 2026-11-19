import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { api } from '../../../shared/api/apiClient';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { colors } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import { s, useAction, useData } from '../../inventory/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'HandoverAmc'>;
type Unit = { id: string; name: string; serialNo: string; location?: string; verified: boolean; assetId?: string | null };
type Handover = { status: string; handoverDate: string; returnReason: string | null; equipment: Unit[] };
type Amc = { id: string; projectId: string; number: string; clientName: string; startDate: string; endDate: string; contractValue: number; status: string; daysToEnd: number; assets: number; revenue: number; expenses: number; profit: number; marginPct: number | null; visits: { preventive: number; complaints: number; open: number }; schedule: { id: string; dueDate: string; amount: number; label: string; invoiceId: string | null; due: boolean }[] };

// Project -> service handover (service head verifies every serial), and AMC contracts with billing and profit.
export function HandoverAmcScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const service = can(user, PERMS.SERVICE_MANAGE);
  const pm = can(user, PERMS.PROJECT_MANAGE);
  const fetcher = useCallback(async () => ({
    handover: await api<Handover | null>(`/projects/${id}/handover`).catch(() => null),
    amc: await api<{ rows: Amc[] }>('/amc').catch(() => ({ rows: [] as Amc[] })),
    boq: await projectApi.boq(id),
  }), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [item, setItem] = useState('');
  const [serials, setSerials] = useState('');
  const [name, setName] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [a, setA] = useState<Record<string, string>>({});
  if (error) return <AppScreen title="Handover & AMC" onBack={() => navigation.navigate('ProjectDetail', { id })}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const h = data?.handover;
  const myAmc = data?.amc.rows.filter((x) => x.projectId === id) ?? [];

  return (
    <AppScreen title="Handover & AMC" subtitle="Equipment moves to the service team after the service head verifies it" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="handover-screen">
      {problem ? <ErrorBanner message={problem} testID="ho-problem" /> : null}
      {h ? (
        <View style={s.card}>
          <View style={s.row}><Text style={s.title}>Handover {formatDate(h.handoverDate)}</Text><StatusChip label={h.status} tone={h.status === 'accepted' ? 'success' : h.status === 'returned' ? 'danger' : 'info'} testID="ho-status" /></View>
          {h.returnReason ? <Text style={s.danger}>Returned: {h.returnReason}</Text> : null}
          {h.equipment.map((e) => {
            const on = checked.includes(e.serialNo) || e.verified;
            return <Pressable key={e.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} disabled={!(service && h.status === 'submitted')} onPress={() => setChecked(on ? checked.filter((x) => x !== e.serialNo) : [...checked, e.serialNo])} testID={`ho-unit-${e.serialNo}`}><Text style={[s.muted, on && { color: colors.success }]}>{on ? '☑' : '☐'} {e.name} · SN {e.serialNo}{e.location ? ` · ${e.location}` : ''}</Text></Pressable>;
          })}
          <View style={s.row}>
            {pm && ['draft', 'returned'].includes(h.status) ? <Button title="Submit to service" onPress={() => run('submit', () => api(`/projects/${id}/handover/submit`, { method: 'POST' }))} testID="ho-submit" /> : null}
            {service && h.status === 'submitted' ? <><Button title={`Accept (${checked.length}/${h.equipment.length} verified)`} onPress={() => run('accept', () => api(`/projects/${id}/handover/decision`, { method: 'POST', body: { action: 'accept', verifiedSerials: checked } }))} testID="ho-accept" /><Button title="Return to project team" variant="ghost" onPress={() => run('return', () => api(`/projects/${id}/handover/decision`, { method: 'POST', body: { action: 'return', reason: 'Serial numbers do not match site' } }))} /></> : null}
          </View>
        </View>
      ) : null}
      {pm && (!h || ['draft', 'returned'].includes(h.status)) && data ? (
        <View style={s.form}>
          <Text style={s.title}>Prepare handover</Text>
          <ChoiceChips label="BOQ item" options={data.boq.map((i) => ({ value: i.id, label: `${i.serialNo} ${i.description.slice(0, 25)}` }))} value={item} onChange={setItem} testID="ho-item" />
          <TextField label="Equipment name" value={name} onChangeText={setName} testID="ho-name" />
          <TextField label="Serial numbers (one per line or comma separated)" value={serials} onChangeText={setSerials} multiline testID="ho-serials" />
          <Button title="Save handover list" onPress={() => run('save', () => api(`/projects/${id}/handover`, { method: 'PUT', body: { handoverDate: todayLocal(), equipment: serials.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).map((serialNo) => ({ workOrderItemId: item, name, serialNo, warrantyMonths: 12 })) } }))} loading={busy === 'save'} testID="ho-save" />
        </View>
      ) : null}
      <Text style={s.title}>AMC contracts</Text>
      {myAmc.map((c) => (
        <View key={c.id} style={s.card} testID={`amc-${c.number}`}>
          <View style={s.row}><Text style={s.number}>{c.number}</Text><StatusChip label={c.status === 'active' && c.daysToEnd <= 30 ? `Renew: ends in ${c.daysToEnd} days` : c.status} tone={c.status === 'active' && c.daysToEnd <= 30 ? 'warning' : c.status === 'active' ? 'success' : 'neutral'} /></View>
          <Text style={s.muted}>{c.clientName} · {formatDate(c.startDate)} to {formatDate(c.endDate)} · {c.assets} unit(s) · {formatMoney(c.contractValue)}</Text>
          <Text style={s.muted}>Revenue {formatMoney(c.revenue)} · expenses {formatMoney(c.expenses)} · profit {formatMoney(c.profit)}{c.marginPct != null ? ` (${c.marginPct}%)` : ''} · visits {c.visits.preventive} PM, {c.visits.complaints} complaints, {c.visits.open} open</Text>
          {c.schedule.map((x) => (
            <View key={x.id} style={s.row}>
              <Text style={[x.due && !x.invoiceId ? s.warn : s.muted, s.cell]}>{formatDate(x.dueDate)} · {x.label} · {formatMoney(x.amount)}{x.invoiceId ? ' · invoiced' : x.due ? ' · due' : ''}</Text>
              {!x.invoiceId && (can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT)) ? <Button title="Invoice" variant="outline" onPress={() => run(`i-${x.id}`, () => api(`/amc/${c.id}/schedule/${x.id}/invoice`, { method: 'POST' }))} testID={`amc-bill-${c.number}-${x.dueDate}`} /> : null}
            </View>
          ))}
          {service ? (
            <View style={s.row}>
              <TextField label="Expense ₹" value={a[`e-${c.id}`] ?? ''} onChangeText={(t) => setA((x) => ({ ...x, [`e-${c.id}`]: t }))} keyboardType="decimal-pad" />
              <Button title="Add parts expense" variant="ghost" onPress={() => run(`e-${c.id}`, () => api(`/amc/${c.id}/expenses`, { method: 'POST', body: { date: todayLocal(), category: 'parts', amount: parseNumber(a[`e-${c.id}`] ?? '') ?? 0 } }))} />
            </View>
          ) : null}
        </View>
      ))}
      {service && h?.status === 'accepted' ? (
        <View style={s.form}>
          <Text style={s.title}>New AMC for this project's equipment</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Start (YYYY-MM-DD)" value={a.start ?? ''} onChangeText={(t) => setA((x) => ({ ...x, start: t }))} testID="amc-start" /></View>
            <View style={s.cell}><TextField label="End (YYYY-MM-DD)" value={a.end ?? ''} onChangeText={(t) => setA((x) => ({ ...x, end: t }))} testID="amc-end" /></View>
            <View style={s.cell}><TextField label="Contract value ₹" value={a.value ?? ''} onChangeText={(t) => setA((x) => ({ ...x, value: t }))} keyboardType="decimal-pad" testID="amc-value" /></View>
          </View>
          <Button title="Create AMC (quarterly billing, 4 visits a year)" onPress={() => run('amc', () => api('/amc', { method: 'POST', body: { projectId: id, assetIds: h.equipment.map((e) => e.assetId).filter(Boolean), startDate: a.start, endDate: a.end, contractValue: parseNumber(a.value ?? '') ?? 0 } }))} loading={busy === 'amc'} testID="amc-create" />
        </View>
      ) : null}
    </AppScreen>
  );
}
