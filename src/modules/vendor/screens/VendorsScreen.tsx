import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { vendorApi } from '../api/vendorApi';
import { VendorForm } from '../VendorForm';
import type { Vendor } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Vendors'>;

export function VendorsScreen({ navigation }: Props) {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setVendors(await vendorApi.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load vendors');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const toggle = async (v: Vendor) => {
    await vendorApi.update(v.id, { isActive: !v.isActive }).catch(() => undefined);
    load();
  };

  return (
    <AppScreen title="Vendors" subtitle="Suppliers you raise purchase orders to" onBack={() => navigation.navigate('Dashboard')} right={!adding ? <Button title="Add vendor" onPress={() => setAdding(true)} testID="add-vendor" /> : null} testID="vendors-screen">
      {adding ? <VendorForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!vendors && !error ? <ActivityIndicator /> : null}
      {vendors && vendors.length === 0 && !adding ? <EmptyState title="No vendors yet" body="Add the suppliers you buy material from." /> : null}
      <View style={styles.list}>
        {vendors?.map((v) => (
          <View key={v.id} style={[styles.card, !v.isActive && styles.off]} testID={`vendor-${v.name}`}>
            <View style={styles.flex}>
              <Text style={styles.name}>{v.name}</Text>
              <Text style={styles.muted}>{[v.contactPerson, v.phone, v.gstin && `GSTIN ${v.gstin}`].filter(Boolean).join(' · ') || 'No contact details'}</Text>
            </View>
            {!v.isActive ? <StatusChip label="Inactive" tone="neutral" /> : null}
            <Button title={v.isActive ? 'Deactivate' : 'Activate'} variant="ghost" onPress={() => toggle(v)} />
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, flexWrap: 'wrap' },
  off: { opacity: 0.6 },
  flex: { flex: 1, minWidth: 200, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
