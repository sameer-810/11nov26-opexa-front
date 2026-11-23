import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { AppScreen } from '../../shared/ui/AppScreen';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ActivityFeed } from './ActivityTimeline';
import { entityLabel } from './activityApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectActivity'>;
const TYPES = ['', 'project', 'boq_item', 'milestone', 'requisition', 'purchase_order', 'delivery_challan', 'invoice', 'expense', 'material_return', 'stock_transfer'];

// 1A.6: everything that changed on one project, newest first. Any project member can read it.
export function ProjectActivityScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [entityType, setEntityType] = useState('');
  const filters = { projectId: id, entityType: entityType || undefined };
  return (
    <AppScreen title="Project activity" subtitle="Who changed what, and when" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-activity-screen">
      <ChoiceChips label="Show" value={entityType} onChange={setEntityType} options={TYPES.map((t) => ({ value: t, label: t ? entityLabel(t) : 'Everything' }))} testID="pa-type" />
      <ActivityFeed key={JSON.stringify(filters)} filters={filters} />
    </AppScreen>
  );
}
