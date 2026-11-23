import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationApi } from '../modules/notification/api/notificationApi';
import { glass } from '../shared/designSystem';
import { can, PERMS } from '../shared/permissions';
import { useAuth } from '../shared/store/useAuthStore';
import { lit } from '../shared/ui/Glass';
import { Icon, type IconName } from '../shared/ui/Icon';
import { activeItem } from './navItems';

type Props = { route?: string; go: (route: string) => void; children: ReactNode };

const TABS: { route: string; label: string; icon: IconName }[] = [
  { route: 'Dashboard', label: 'Home', icon: 'home' },
  { route: 'Projects', label: 'Projects', icon: 'folder' },
  { route: 'Requisitions', label: 'Requests', icon: 'clipboard' },
  { route: 'Notifications', label: 'Alerts', icon: 'bell' },
];

// Phone / narrow-window frame: page above, bottom tab bar with a floating "+" for quick actions.
export function PhoneShell({ route, go, children }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const current = route === 'Notifications' ? 'Notifications' : activeItem(route);

  useEffect(() => {
    notificationApi.list().then((r) => setUnread(r.unread)).catch(() => undefined);
    setOpen(false);
  }, [route]);

  const actions = [
    can(user, PERMS.ATTENDANCE_SELF) && { label: 'Check in / out', icon: 'clock' as IconName, route: 'Attendance' },
    can(user, PERMS.REQUISITION_CREATE) && { label: 'New material request', icon: 'clipboard' as IconName, route: 'Projects' },
    can(user, PERMS.RECEIVING_RECORD) && { label: 'Deliveries to check in', icon: 'truck' as IconName, route: 'Projects' },
    can(user, PERMS.SERVICE_MANAGE) && { label: 'New complaint', icon: 'tool' as IconName, route: 'NewTicket' },
    can(user, PERMS.APPROVAL_ACT) && { label: 'My approvals', icon: 'check' as IconName, route: 'Approvals' },
  ].filter(Boolean) as { label: string; icon: IconName; route: string }[];

  const tab = (t: (typeof TABS)[number]) => {
    const active = current === t.route;
    return (
      <Pressable key={t.route} onPress={() => go(t.route)} style={(s) => [styles.tab, lit(s) && styles.lit]} accessibilityRole="tab" accessibilityState={{ selected: active }} testID={`tab-${t.route}`}>
        <View>
          <Icon name={t.icon} size={22} color={active ? glass.indigo : glass.inkMuted} />
          {t.route === 'Notifications' && unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.flex}>{children}</View>
      {open ? (
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close quick actions" testID="quick-close">
          <View style={[styles.sheet, { marginBottom: 74 + insets.bottom }]}>
            <Text style={styles.sheetTitle}>Quick actions</Text>
            {actions.length === 0 ? <Text style={styles.label}>Nothing to add for your role.</Text> : null}
            {actions.map((a) => (
              <Pressable key={a.label} onPress={() => go(a.route)} style={(s) => [styles.action, lit(s) && styles.lit]} accessibilityRole="button" testID={`quick-${a.route}`}>
                <View style={styles.actionIcon}><Icon name={a.icon} size={18} color={glass.indigo} /></View>
                <Text style={styles.actionText}>{a.label}</Text>
                <Icon name="chevronRight" size={16} color={glass.inkMuted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      ) : null}
      <View style={[styles.bar, { paddingBottom: 8 + insets.bottom }]} testID="phone-tabbar">
        {TABS.slice(0, 2).map(tab)}
        <View style={styles.fabSlot}>
          <Pressable onPress={() => setOpen((o) => !o)} style={styles.fab} accessibilityRole="button" accessibilityLabel="Quick actions" testID="tab-fab">
            <Text style={styles.fabPlus}>{open ? '×' : '+'}</Text>
          </Pressable>
        </View>
        {TABS.slice(2).map(tab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingTop: 8, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0px -6px 24px rgba(30,27,75,0.08)' },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  lit: { opacity: 0.7 },
  label: { fontSize: 11, color: glass.inkMuted, fontWeight: '600' },
  labelActive: { color: glass.indigo },
  badge: { position: 'absolute', top: -4, right: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: glass.pink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  fabSlot: { flex: 1, alignItems: 'center' },
  fab: { width: 58, height: 58, borderRadius: 29, marginTop: -30, backgroundColor: glass.green, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: glass.canvas, boxShadow: '0px 8px 18px rgba(16,185,129,0.40)' },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '700', lineHeight: 32 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,27,75,0.35)', justifyContent: 'flex-end', paddingHorizontal: 16, zIndex: 5 },
  sheet: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 4 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: glass.ink, marginBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(91,91,239,0.10)', alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600', color: glass.ink },
});
