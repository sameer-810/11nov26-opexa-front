import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { s, useAction, useData } from '../../inventory/ui';
import { projectApi } from '../api/projectApi';
import { SitePanel } from '../components/SitePanel';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectSites'>;

// Phase 2 access: the sites of a project. People can be limited to some sites from Team → member → Projects and sites.
export function ProjectSitesScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const manage = can(user, PERMS.PROJECT_MANAGE);
  const fetcher = useCallback(() => projectApi.sites(id), [id]);
  const { data, error, reload } = useData(fetcher);
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', address: '', lat: '', lng: '', radius: '' });
  const { busy, problem, run } = useAction(() => { setF({ name: '', address: '', lat: '', lng: '', radius: '' }); void reload(); });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const add = () => run('add', async () => {
    const lat = parseNumber(f.lat);
    const lng = parseNumber(f.lng);
    const radius = parseNumber(f.radius);
    await projectApi.addSite(id, {
      name: f.name.trim(), address: f.address.trim() || undefined,
      ...(lat != null && lng != null ? { location: { lat, lng } } : {}),
      ...(radius ? { geofenceRadiusM: Math.round(radius) } : {}),
    });
  });

  return (
    <AppScreen title="Sites" subtitle="Each site has its own address and attendance area; people can be limited to some sites" onBack={() => navigation.navigate('ProjectDetail', { id })} testID="project-sites-screen">
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {problem ? <ErrorBanner message={problem} testID="sites-problem" /> : null}
      <View style={s.list}>
        {(data ?? []).map((site) => (
          <View key={site.id} style={s.card} testID={`site-${site.code}`}>
            <View style={s.row}>
              <Text style={s.title}>{site.code} · {site.name}</Text>
              <StatusChip label={site.isMain ? 'Main site' : site.isActive ? 'Open' : 'Closed'} tone={site.isActive ? (site.isMain ? 'info' : 'success') : 'neutral'} />
            </View>
            <Text style={s.muted}>{site.address || 'No address'}{site.location ? ` · GPS ${site.location.lat.toFixed(5)}, ${site.location.lng.toFixed(5)}` : ''} · attendance within {site.geofenceRadiusM} m</Text>
            <View style={s.row}>
              <Button title={open === site.id ? 'Hide team & history' : 'Team & history'} variant="ghost" onPress={() => setOpen(open === site.id ? null : site.id)} testID={`site-open-${site.code}`} />
              {manage && !site.isMain ? (
                <Button title={site.isActive ? 'Close site' : 'Reopen site'} variant="ghost" onPress={() => run(`t-${site.id}`, () => projectApi.updateSite(id, site.id, { isActive: !site.isActive }))} loading={busy === `t-${site.id}`} testID={`site-toggle-${site.code}`} />
              ) : null}
            </View>
            {open === site.id ? <SitePanel projectId={id} siteId={site.id} manage={manage} onChanged={() => void reload()} /> : null}
          </View>
        ))}
      </View>
      {manage ? (
        <View style={[s.card, { marginTop: 16 }]}>
          <Text style={s.title}>Add a site</Text>
          <TextField label="Site name" value={f.name} onChangeText={set('name')} testID="site-name" />
          <TextField label="Address (optional)" value={f.address} onChangeText={set('address')} testID="site-address" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="GPS latitude (optional)" value={f.lat} onChangeText={set('lat')} keyboardType="decimal-pad" testID="site-lat" /></View>
            <View style={s.cell}><TextField label="GPS longitude (optional)" value={f.lng} onChangeText={set('lng')} keyboardType="decimal-pad" testID="site-lng" /></View>
            <View style={s.cell}><TextField label="Attendance radius, m (optional)" value={f.radius} onChangeText={set('radius')} keyboardType="number-pad" testID="site-radius" /></View>
          </View>
          <Button title="Add site" onPress={add} loading={busy === 'add'} disabled={f.name.trim().length < 2} testID="site-add" />
        </View>
      ) : null}
    </AppScreen>
  );
}
