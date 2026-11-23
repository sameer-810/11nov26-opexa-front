import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { s, useAction, useData } from '../../inventory/ui';
import { customerApi, type CustomerDetail } from '../api/handoverApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Customers'>;

// Light customer master (5A/5B): one record per client, linked to its projects (by client name), equipment and AMCs.
export function CustomersScreen({ navigation }: Props) {
  const { user } = useAuth();
  const edit = [PERMS.SERVICE_MANAGE, PERMS.PROJECT_MANAGE, PERMS.SALES_MANAGE].some((p) => can(user, p));
  const [q, setQ] = useState('');
  const fetcher = useCallback(() => customerApi.list(q.trim()), [q]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [open, setOpen] = useState<CustomerDetail | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (t: string) => setF((x) => ({ ...x, [k]: t }));
  if (error) return <AppScreen title="Customers" onBack={() => navigation.navigate('Service')}><ErrorState message={error} onRetry={reload} /></AppScreen>;

  const show = (id: string) => run(`o-${id}`, async () => setOpen(await customerApi.get(id)));
  const create = () => run('add', async () => {
    const contact = (f.contact ?? '').trim() || (f.phone ?? '').trim() ? [{ name: (f.contact ?? '').trim() || undefined, phone: (f.phone ?? '').trim() || undefined }] : undefined;
    setOpen(await customerApi.create({ name: (f.name ?? '').trim(), gstin: (f.gstin ?? '').trim() || undefined, address: (f.address ?? '').trim() || undefined, contacts: contact }));
    setF({});
  });

  return (
    <AppScreen title="Customers" subtitle="Clients with their projects, equipment and AMCs" onBack={() => navigation.navigate('Service')} testID="customers-screen">
      {problem ? <ErrorBanner message={problem} testID="cust-problem" /> : null}
      <View style={s.row}>
        <View style={s.cell}><TextField label="Search" value={q} onChangeText={setQ} testID="cust-search" /></View>
        {edit ? <Button title="Add customers from project client names" variant="outline" onPress={() => run('sync', async () => { const r = await customerApi.syncFromProjects(); setProblem(r.created ? '' : 'Every project client is already in the list'); })} loading={busy === 'sync'} testID="cust-sync" /> : null}
      </View>
      {data?.map((c) => (
        <Pressable key={c.id} style={s.card} onPress={() => show(c.id)} accessibilityRole="button" testID={`cust-${c.name}`}>
          <View style={s.row}><Text style={s.title}>{c.name}</Text>{c.activeAmcs ? <StatusChip label={`${c.activeAmcs} active AMC`} tone="success" /> : null}</View>
          <Text style={s.muted}>{c.gstin || 'No GSTIN'} · {c.assets ?? 0} unit(s){c.contacts[0]?.phone ? ` · ${c.contacts[0].name} ${c.contacts[0].phone}` : ''}</Text>
        </Pressable>
      ))}
      {data && !data.length ? <Text style={s.muted}>No customers yet.</Text> : null}
      {open ? (
        <View style={s.card} testID="cust-detail">
          <Text style={s.title}>{open.name}</Text>
          <Text style={s.muted}>{open.address || 'No address'}{open.gstin ? ` · GSTIN ${open.gstin}` : ''}</Text>
          {open.contacts.map((x, i) => <Text key={i} style={s.muted}>{[x.name, x.designation, x.phone, x.email].filter(Boolean).join(' · ')}</Text>)}
          <Text style={s.muted}>{open.assets} unit(s) in the service register</Text>
          {open.projects.map((p) => <Text key={p.id} style={s.muted} onPress={() => navigation.navigate('ProjectDetail', { id: p.id })}>Project {p.code} {p.name} · {p.status}</Text>)}
          {open.amcs.map((a) => <Text key={a.id} style={s.muted}>{a.number} · {a.status} · {formatDate(a.startDate)} to {formatDate(a.endDate)} · {formatMoney(a.contractValue)}</Text>)}
          <Button title="Close" variant="ghost" onPress={() => setOpen(null)} />
        </View>
      ) : null}
      {edit ? (
        <View style={s.form}>
          <Text style={s.title}>New customer</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Name" value={f.name ?? ''} onChangeText={set('name')} testID="cust-name" /></View>
            <View style={s.cell}><TextField label="GSTIN" value={f.gstin ?? ''} onChangeText={set('gstin')} autoCapitalize="characters" /></View>
          </View>
          <TextField label="Address" value={f.address ?? ''} onChangeText={set('address')} multiline />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Contact person" value={f.contact ?? ''} onChangeText={set('contact')} /></View>
            <View style={s.cell}><TextField label="Phone" value={f.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" /></View>
          </View>
          <Button title="Add customer" onPress={create} disabled={(f.name ?? '').trim().length < 2} loading={busy === 'add'} testID="cust-add" />
        </View>
      ) : null}
    </AppScreen>
  );
}
