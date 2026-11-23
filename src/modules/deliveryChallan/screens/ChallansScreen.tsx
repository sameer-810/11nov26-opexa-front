import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { challanApi } from '../api/challanApi';
import { ChallanList } from '../components/ChallanList';
import type { DeliveryChallan } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Challans'>;

// Delivery challans of one project, or of every project the user can see; search by DC or supplier challan no.
export function ChallansScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const [q, setQ] = useState('');
  const search = useDebouncedValue(q.trim(), 300);
  const [rows, setRows] = useState<DeliveryChallan[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await challanApi.list({ projectId, q: search || undefined }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load challans');
    }
  }, [projectId, search]);
  // Also re-runs when the search changes while the screen is open.
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <AppScreen
      title="Delivery challans"
      subtitle={projectId ? (rows?.[0] ? `${rows[0].projectCode} · ${rows[0].projectName}` : 'This project') : 'All projects you can see'}
      onBack={() => (projectId ? navigation.navigate('ProjectDetail', { id: projectId }) : navigation.navigate('Dashboard'))}
      testID="challans-screen"
    >
      <TextField label="Search DC no. or supplier challan no." value={q} onChangeText={setQ} autoCapitalize="characters" testID="dc-search" />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <ActivityIndicator /> : null}
      {rows && rows.length === 0 ? <EmptyState title={search ? 'No challan matches' : 'No delivery challans yet'} body="Challans are created from “Material received” on an approved material request." /> : null}
      {rows?.length ? <ChallanList items={rows} showRequest onOpen={(dc) => navigation.navigate('ChallanDetail', { id: dc.id })} /> : null}
    </AppScreen>
  );
}
