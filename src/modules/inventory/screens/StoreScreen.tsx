import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { StockTab } from '../components/StockTab';
import { TransfersTab } from '../components/TransfersTab';
import { IssuesTab } from '../components/IssuesTab';
import { ToolsTab } from '../components/ToolsTab';
import { MaterialsTab } from '../components/MaterialsTab';

type Props = NativeStackScreenProps<RootStackParamList, 'Store'>;
const TABS = [{ value: 'stock', label: 'Stock' }, { value: 'transfers', label: 'Transfers' }, { value: 'issues', label: 'Issues' }, { value: 'tools', label: 'Tools' }, { value: 'materials', label: 'Materials' }];

export function StoreScreen({ navigation }: Props) {
  const [tab, setTab] = useState('stock');
  return (
    <AppScreen title="Store" subtitle="Warehouses and site stock, transfers with gate pass, issues, tools and materials" onBack={() => navigation.navigate('Dashboard')} testID="store-screen">
      <ChoiceChips label="Section" options={TABS} value={tab} onChange={setTab} testID="store-tab" />
      {tab === 'stock' ? <StockTab /> : null}
      {tab === 'transfers' ? <TransfersTab /> : null}
      {tab === 'issues' ? <IssuesTab /> : null}
      {tab === 'tools' ? <ToolsTab /> : null}
      {tab === 'materials' ? <MaterialsTab /> : null}
    </AppScreen>
  );
}
