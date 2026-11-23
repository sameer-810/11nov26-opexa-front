import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { HandoverPanel } from '../components/HandoverPanel';
import { AmcPanel } from '../components/AmcPanel';
import type { Handover } from '../api/handoverApi';

type Props = NativeStackScreenProps<RootStackParamList, 'HandoverAmc'>;

// Project completion and handover to service (Q29), then the AMC contracts on the handed-over equipment (Q30).
export function HandoverAmcScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [handover, setHandover] = useState<Handover | null>(null);
  return (
    <AppScreen title="Handover & AMC" subtitle="Equipment moves to the service team after the project is complete and the service head verifies it" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="handover-screen">
      <HandoverPanel projectId={id} pm={can(user, PERMS.PROJECT_MANAGE)} service={can(user, PERMS.SERVICE_MANAGE)} onLoaded={setHandover} />
      <AmcPanel projectId={id} handover={handover} service={can(user, PERMS.SERVICE_MANAGE)} canBill={can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT)} />
    </AppScreen>
  );
}
