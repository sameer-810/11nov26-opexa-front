import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, canEditBoq, PERMS } from '../../../shared/permissions';
import { formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { projectApi } from '../api/projectApi';
import { BoqTable } from '../components/BoqTable';
import { BoqItemForm } from '../components/BoqItemForm';
import { STATUS_LABEL, type BoqItem, type Project } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

const nextSerial = (items: BoqItem[]) => {
  const nums = items.map((i) => Number(i.serialNo)).filter((n) => Number.isInteger(n));
  return nums.length ? String(Math.max(...nums) + 1) : String(items.length + 1);
};

export function ProjectDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const manage = can(user, PERMS.PROJECT_MANAGE);
  const editBoq = canEditBoq(user);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<BoqItem | 'new' | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, boq] = await Promise.all([projectApi.get(id), projectApi.boq(id)]);
      setProject(p);
      setItems(boq);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the project');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const back = () => navigation.navigate('Projects');
  if (error) return <AppScreen title="Project" onBack={back}><ErrorState message={error} onRetry={load} /></AppScreen>;
  if (!project) return <AppScreen title="Project" onBack={back}><ActivityIndicator /></AppScreen>;

  const afterChange = async () => {
    setEditing(null);
    await load();
  };

  return (
    <AppScreen
      title={project.name}
      subtitle={`${project.code} · ${project.clientName}`}
      onBack={back}
      right={
        <View style={styles.row}>
          <StatusChip label={STATUS_LABEL[project.status]} tone={project.status === 'active' ? 'success' : 'warning'} />
          {manage ? <Button title="Edit" variant="outline" onPress={() => navigation.navigate('EditProject', { id })} testID="edit-project" /> : null}
        </View>
      }
      testID="project-detail-screen"
    >
      <View style={styles.facts}>
        <Fact label="Site" value={project.siteAddress || '—'} />
        <Fact label="Client PO" value={project.clientPoNumber || '—'} />
        <Fact label="Site location" value={project.location ? `${project.location.lat.toFixed(5)}, ${project.location.lng.toFixed(5)} (${project.geofenceRadiusM} m)` : 'Not set'} testID="fact-location" />
        <Fact label="Team" value={`${project.memberIds.length} member${project.memberIds.length === 1 ? '' : 's'}`} />
        <Fact label="BOQ value" value={formatMoney(project.boqValue)} testID="fact-boq-value" />
      </View>
      <View style={styles.row}>
        <Button title="Material requests" onPress={() => navigation.navigate('Requisitions', { projectId: id })} testID="project-requisitions" />
        <Button title="Deliveries (lots)" variant="outline" onPress={() => navigation.navigate('ProjectLots', { id })} testID="project-lots" />
        <Button title="Material status" variant="outline" onPress={() => navigation.navigate('MaterialStatus', { id })} testID="project-material" />
        <Button title="Local purchase" variant="outline" onPress={() => navigation.navigate('LocalPurchases', { id })} testID="project-local-purchase" />
        <Button title="Installation log" variant="outline" onPress={() => navigation.navigate('Usage', { id })} testID="project-usage" />
        <Button title="Returns & transfers" variant="outline" onPress={() => navigation.navigate('ProjectReturns', { id })} testID="project-returns" />
        <Button title="Stock count" variant="outline" onPress={() => navigation.navigate('StockCount', { id })} testID="project-stock-count" />
        {can(user, PERMS.PROJECT_MANAGE) || can(user, PERMS.REPORTS_VIEW) ? <Button title="Costing" variant="outline" onPress={() => navigation.navigate('ProjectCost', { id })} testID="project-costing" /> : null}
        {can(user, PERMS.REQUISITION_CREATE) && project.status !== 'closed' && items.length > 0 ? (
          <Button title="New material request" variant="outline" onPress={() => navigation.navigate('NewRequisition', { projectId: id })} testID="project-new-requisition" />
        ) : null}
        {manage ? <Button title="Manage project team" variant="outline" onPress={() => navigation.navigate('ProjectTeam', { id })} testID="manage-team" /> : null}
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.section}>Work order (BOQ)</Text>
        {editBoq ? (
          <View style={styles.row}>
            <Button title="Import from Excel" variant="outline" onPress={() => navigation.navigate('BoqImport', { id })} testID="import-boq" />
            <Button title="Add item" onPress={() => setEditing('new')} testID="add-boq-item" />
          </View>
        ) : null}
      </View>

      {editing ? (
        <BoqItemForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          suggestedSerial={nextSerial(items)}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            if (editing === 'new') await projectApi.addItem(id, input);
            else await projectApi.updateItem(id, editing.id, input);
            await afterChange();
          }}
          onDelete={editing === 'new' ? undefined : async () => {
            await projectApi.deleteItem(id, editing.id);
            await afterChange();
          }}
        />
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="No BOQ items yet" body={editBoq ? 'Import the client work order from Excel, or add items one by one.' : 'The office has not loaded the work order yet.'} />
      ) : (
        <>
          {editBoq ? <Text style={styles.muted}>Tap a row to edit it.</Text> : null}
          <BoqTable items={items} onPressItem={editBoq ? (i) => setEditing(i) : undefined} />
        </>
      )}
    </AppScreen>
  );
}

function Fact({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} testID={testID}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { flexGrow: 1, flexBasis: 180, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  factLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  factValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  self: { alignSelf: 'flex-start' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  section: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
