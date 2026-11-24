import { useCallback } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { formatDate } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { s, useData } from '../../inventory/ui';
import { canSeePayables } from '../../supplierPayment/supplierPaymentApi';
import { vendorApi } from '../api/vendorApi';
import { VendorContacts } from '../components/VendorContacts';
import { VendorDocumentUpload } from '../components/VendorDocumentUpload';
import { VendorHistorySection, VendorPerformanceSection } from '../components/VendorInsights';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorDetail'>;
const DAY = 86400000;
const expiry = (until: string | null) => {
  if (!until) return null;
  const days = Math.floor((new Date(until).getTime() - Date.now()) / DAY);
  return days < 0 ? { text: `expired ${formatDate(until)}`, style: s.danger } : days <= 30 ? { text: `expires ${formatDate(until)} (${days} days)`, style: s.warn } : { text: `valid until ${formatDate(until)}`, style: s.muted };
};

// Supplier record: details, contacts, documents (with expiry), transactions and performance.
export function VendorDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const load = useCallback(async () => {
    const [detail, history, performance] = await Promise.all([vendorApi.detail(id), vendorApi.history(id), vendorApi.performance(id)]);
    return { detail, history, performance };
  }, [id]);
  const { data, error, reload } = useData(load);

  if (error) return <AppScreen title="Supplier" onBack={() => navigation.navigate('Vendors')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  if (!data) return <AppScreen title="Supplier" onBack={() => navigation.navigate('Vendors')}><ActivityIndicator /></AppScreen>;
  const v = data.detail;
  return (
    <AppScreen title={v.name} subtitle={[v.code, v.gstin && `GSTIN ${v.gstin}`, v.city].filter(Boolean).join(' · ')} onBack={() => navigation.navigate('Vendors')}
      right={canSeePayables(user) ? <Button title="Ledger" variant="outline" onPress={() => navigation.navigate('SupplierLedger', { vendorId: v.id })} testID="vendor-ledger" /> : null} testID="vendor-detail-screen">
      <View style={s.card}>
        <Text style={s.muted}>Payment terms: {v.paymentTerms ?? '—'} · credit {v.paymentTermsDays ?? 30} days{v.paymentTermsDays === null ? ' (default)' : ''}</Text>
        {v.materials.length ? <Text style={s.muted}>Supplies: {v.materials.join(', ')}</Text> : null}
        <Text style={s.muted}>{v.activity.purchaseOrders} POs ({v.activity.openPurchaseOrders} open) · {v.activity.rfqs} RFQs · {v.activity.invoices} invoices</Text>
      </View>
      <View style={s.card}><VendorContacts vendorId={v.id} contacts={v.contacts} onChanged={() => void reload()} /></View>
      <View style={s.card} testID="vendor-documents">
        <Text style={s.title}>Documents</Text>
        {v.documents.length === 0 ? <Text style={s.muted}>No documents uploaded</Text> : null}
        {v.documents.map((d) => {
          const e = expiry(d.validUntil);
          return <Text key={d.id} style={e?.style ?? s.muted} testID={`vendor-doc-${d.id}`}>{d.label || d.name}{e ? ` · ${e.text}` : ''}</Text>;
        })}
        <VendorDocumentUpload vendorId={v.id} onUploaded={() => void reload()} />
      </View>
      <View style={s.card}><VendorPerformanceSection p={data.performance} /></View>
      <View style={s.card}><VendorHistorySection h={data.history} /></View>
    </AppScreen>
  );
}
