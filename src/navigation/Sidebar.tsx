import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { glass } from '../shared/designSystem';
import { useAuth } from '../shared/store/useAuthStore';
import { lit, GlassCard } from '../shared/ui/Glass';
import { Icon, type IconName } from '../shared/ui/Icon';
import { activeItem, NAV_ITEMS } from './navItems';

type Props = { route?: string; go: (route: string) => void };

function Item({ label, icon, active, onPress, testID }: { label: string; icon: IconName; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityState={{ selected: active }} testID={testID}
      style={(s) => [styles.item, lit(s) && styles.hover, active && styles.active]}>
      <Icon name={icon} size={19} color={active ? glass.indigo : glass.inkMuted} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

// Left navigation for the wide web layout.
export function Sidebar({ route, go }: Props) {
  const { user, organization } = useAuth();
  const current = activeItem(route);
  return (
    <GlassCard style={styles.bar} testID="sidebar">
      <View style={styles.brand}>
        <View style={styles.logo}><Icon name="layers" size={20} color="#fff" strokeWidth={2.2} /></View>
        <View style={styles.flex}>
          <Text style={styles.brandName}>Opexa</Text>
          <Text style={styles.org} numberOfLines={1}>{organization?.name ?? 'HVAC projects'}</Text>
        </View>
      </View>
      {/* Scrolls with the wheel or touchpad when the menu is taller than the window; no scrollbar shown. */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.filter((i) => i.show(user)).map((i) => (
          <Item key={i.route} label={i.label} icon={i.icon} active={current === i.route} onPress={() => go(i.route)} testID={`nav-${i.route}`} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Item label="Password" icon="lock" active={route === 'ChangePassword'} onPress={() => go('ChangePassword')} testID="nav-ChangePassword" />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { width: 236, flex: 1, padding: 14, gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingBottom: 14 },
  logo: { width: 38, height: 38, borderRadius: 12, backgroundColor: glass.indigo, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 16px rgba(91,91,239,0.35)' },
  brandName: { fontSize: 20, fontWeight: '800', color: glass.ink },
  org: { fontSize: 11, color: glass.inkMuted },
  list: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  hover: { backgroundColor: 'rgba(255,255,255,0.6)' },
  active: { backgroundColor: 'rgba(91,91,239,0.12)' },
  label: { fontSize: 14, color: glass.inkMuted, fontWeight: '600' },
  labelActive: { color: glass.indigo },
  footer: { borderTopWidth: 1, borderColor: glass.line, paddingTop: 8 },
});
