import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { TextField } from '../../shared/ui/TextField';
import { errText, s } from '../inventory/ui';
import { projectApi } from '../project/api/projectApi';
import { approvalApi } from '../approval/api/approvalApi';
import { ActivityFeed } from './ActivityTimeline';
import { ENTITY_LABEL, type ActivityFilters } from './activityApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityLog'>;
type Option = { value: string; label: string };
const ALL = '';
const TYPES = ['project', 'boq_item', 'boq_revision', 'requisition', 'purchase_order', 'delivery_challan', 'stock_adjustment', 'invoice', 'expense', 'subcontract_certificate', 'amc', 'asset', 'user'];

// X2: the company-wide audit log, for people with "View the company activity log".
export function ActivityLogScreen({ navigation }: Props) {
  const [f, setF] = useState({ from: `${todayLocal().slice(0, 8)}01`, to: todayLocal(), entityType: ALL, projectId: ALL, userId: ALL });
  const [applied, setApplied] = useState(f);
  const [options, setOptions] = useState<{ projects: Option[]; people: Option[] }>({ projects: [], people: [] });
  const [problem, setProblem] = useState('');

  useEffect(() => {
    void Promise.all([projectApi.list(), approvalApi.people()])
      .then(([p, u]) => setOptions({ projects: p.map((x) => ({ value: x.id, label: x.code })), people: u.map((x) => ({ value: x.id, label: x.name })) }))
      .catch((e: unknown) => setProblem(errText(e)));
  }, []);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const all = (label: string, rest: Option[]) => [{ value: ALL, label }, ...rest];
  const filters: ActivityFilters = Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== ALL));

  return (
    <AppScreen title="Activity log" subtitle="Every change across the company, with old and new values" onBack={() => navigation.navigate('Dashboard')} testID="activity-log-screen">
      <View style={s.form}>
        <View style={s.row}>
          <View style={s.cell}><TextField label="From (YYYY-MM-DD)" value={f.from} onChangeText={set('from')} testID="al-from" /></View>
          <View style={s.cell}><TextField label="To (YYYY-MM-DD)" value={f.to} onChangeText={set('to')} testID="al-to" /></View>
        </View>
        <ChoiceChips label="Record" value={f.entityType} onChange={set('entityType')} options={all('All', TYPES.map((t) => ({ value: t, label: ENTITY_LABEL[t] ?? t })))} testID="al-type" />
        <ChoiceChips label="Project" value={f.projectId} onChange={set('projectId')} options={all('All', options.projects)} testID="al-project" />
        <ChoiceChips label="Changed by" value={f.userId} onChange={set('userId')} options={all('Anyone', options.people)} testID="al-user" />
        <Button title="Show" onPress={() => setApplied(f)} testID="al-show" />
      </View>
      {problem ? <ErrorBanner message={problem} testID="al-problem" /> : null}
      <ActivityFeed key={JSON.stringify(filters)} filters={filters} showProject />
    </AppScreen>
  );
}
