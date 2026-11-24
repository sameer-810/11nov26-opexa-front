import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { can, PERMS } from '../../../shared/permissions';
import { useAuth } from '../../../shared/store/useAuthStore';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { StockTab } from '../components/StockTab';
import { TransfersTab } from '../components/TransfersTab';
import { IssuesTab } from '../components/IssuesTab';
import { ToolsTab } from '../components/ToolsTab';
import { MaterialsTab } from '../components/MaterialsTab';
import { CountsTab } from '../components/CountsTab';
import { WarehousesTab } from '../components/WarehousesTab';

type Props = NativeStackScreenProps<RootStackParamList, 'Store'>;
const TABS = [{ value: 'stock', label: 'Stock' }, { value: 'transfers', label: 'Transfers' }, { value: 'issues', label: 'Issues' }, { value: 'counts', label: 'Physical count' }, { value: 'tools', label: 'Tools' }, { value: 'materials', label: 'Materials' }];

export function StoreScreen({ navigation }: Props) {
  const [tab, setTab] = useState('stock');
  const { user } = useAuth();
  // Adding and editing warehouses is an admin (settings.manage) action in the API.
  const tabs = can(user, PERMS.SETTINGS_MANAGE) ? [...TABS, { value: 'warehouses', label: 'Warehouses' }] : TABS;
  return (
    <AppScreen title="Store" subtitle="Warehouses and site stock, transfers with gate pass, issues, physical counts, tools and materials" onBack={() => navigation.navigate('Dashboard')} testID="store-screen">
      <ChoiceChips label="Section" options={tabs} value={tab} onChange={setTab} testID="store-tab" />
      {tab === 'stock' ? <StockTab /> : null}
      {tab === 'transfers' ? <TransfersTab /> : null}
      {tab === 'issues' ? <IssuesTab /> : null}
      {tab === 'counts' ? <CountsTab /> : null}
      {tab === 'tools' ? <ToolsTab /> : null}
      {tab === 'materials' ? <MaterialsTab /> : null}
      {tab === 'warehouses' ? <WarehousesTab /> : null}
    </AppScreen>
  );
}
