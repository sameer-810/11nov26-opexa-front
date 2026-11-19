import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { procurementApi } from '../api/procurementApi';
import type { PendingQuantities } from '../types';
import { Loading, Section, styles, useLoad } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PendingQuantities'>;
const VIEWS = [{ value: 'rows', label: 'By item' }, { value: 'byProject', label: 'Project' }, { value: 'bySupplier', label: 'Supplier' }, { value: 'byMaterial', label: 'Material' }, { value: 'byDepartment', label: 'Department' }, { value: 'byExpectedDate', label: 'Expected date' }];
const COLS: [string, string][] = [['requested', 'Req'], ['approved', 'Appr'], ['rfq', 'RFQ'], ['quoted', 'Quoted'], ['selected', 'Sel'], ['ordered', 'Ord'], ['received', 'Recd'], ['accepted', 'Acc'], ['rejected', 'Rej'], ['cancelled', 'Canc'], ['toOrder', 'To order'], ['pending', 'Pending']];

export function PendingQuantitiesScreen({ navigation }: Props) {
  const [view, setView] = useState('rows');
  const [material, setMaterial] = useState('');
  const fetcher = useCallback(() => procurementApi.pendingQuantities(material.trim().length > 1 ? { material: material.trim() } : {}), [material]);
  const { data, error, reload } = useLoad<PendingQuantities>(fetcher);

  return (
    <AppScreen title="Pending quantities" subtitle="Requested → approved → RFQ → quoted → selected → ordered → received, per item" onBack={() => navigation.navigate('Procurement')} testID="pending-screen">
      <ChoiceChips label="View" options={VIEWS} value={view} onChange={setView} testID="pq-view" />
      <TextField label="Filter by material" value={material} onChangeText={setMaterial} placeholder="e.g. copper" testID="pq-material" />
      <Loading error={error} onRetry={reload} loaded={Boolean(data)} />
      {data && view === 'rows' ? (
        <ScrollView horizontal>
          <View style={styles.list}>
            {data.rows.length === 0 ? <Text style={styles.muted}>No open material requests.</Text> : null}
            {data.rows.map((r) => (
              <View key={r.requisitionLineId} style={styles.card} testID={`pq-${r.requisitionNumber}-${r.serialNo}`}>
                <Text style={styles.title}>{r.requisitionNumber} · S.No {r.serialNo} {r.description} ({r.unit})</Text>
                <Text style={styles.muted}>{r.projectName}{r.department ? ` · ${r.department}` : ''}{r.suppliers.length ? ` · ${r.suppliers.join(', ')}` : ''}{r.expectedDate ? ` · due ${formatDate(r.expectedDate)}` : ''}</Text>
                <Text style={styles.muted}>{COLS.map(([k, l]) => `${l} ${formatNumber(r[k as keyof typeof r] as number)}`).join(' · ')}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {data && view !== 'rows' ? (
        <Section title={VIEWS.find((v) => v.value === view)?.label ?? ''}>
          {(data[view as keyof PendingQuantities] as PendingQuantities['byProject']).map((g) => (
            <Text key={g.key} style={styles.muted}>{g.key}: {g.lines} item(s) · approved {formatNumber(g.approved)} · ordered {formatNumber(g.ordered)} · accepted {formatNumber(g.accepted)} · to order {formatNumber(g.toOrder)} · pending {formatNumber(g.pending)}</Text>
          ))}
        </Section>
      ) : null}
    </AppScreen>
  );
}
