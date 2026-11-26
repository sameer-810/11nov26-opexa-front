import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { notificationApi } from '../modules/notification/api/notificationApi';
import { ROLE_LABEL } from '../modules/team/types';
import { glass } from '../shared/designSystem';
import { useAuth } from '../shared/store/useAuthStore';
import { lit, Backdrop, GlassCard } from '../shared/ui/Glass';
import { Icon } from '../shared/ui/Icon';
import { Sidebar } from './Sidebar';

type Props = { route?: string; go: (route: string) => void; children: ReactNode };

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

// Wide-screen web frame: glass sidebar, top bar (date, notifications, account) and the page.
export function WebShell({ route, go, children }: Props) {
  const { user, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);

  // Refresh the bell whenever the page changes.
  useEffect(() => {
    notificationApi.list().then((r) => setUnread(r.unread)).catch(() => undefined);
    setMenu(false);
  }, [route]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={styles.side}><Sidebar route={route} go={go} /></View>
      <View style={styles.main}>
        <View style={styles.top}>
          <GlassCard style={styles.pill}>
            <Icon name="calendar" size={17} color={glass.inkMuted} />
            <Text style={styles.pillText}>{today}</Text>
          </GlassCard>
          <View style={styles.flex} />
          <Pressable onPress={() => go('Notifications')} accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} testID="topbar-bell">
            <GlassCard style={styles.bell}>
              <Icon name="bell" size={20} color={glass.ink} />
              {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
            </GlassCard>
          </Pressable>
          <View>
            <Pressable onPress={() => setMenu((m) => !m)} accessibilityRole="button" accessibilityLabel="Account menu" testID="topbar-user">
              <GlassCard style={styles.user}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.name)}</Text></View>
                <View>
                  <Text style={styles.userName}>{user?.name}</Text>
                  <Text style={styles.userRole}>{user ? ROLE_LABEL[user.role] ?? user.role : ''}</Text>
                </View>
                <Icon name="chevronDown" size={16} color={glass.inkMuted} />
              </GlassCard>
            </Pressable>
            {menu ? (
              <View style={styles.menu}>
                <Pressable style={(s) => [styles.menuItem, lit(s) && styles.menuHover]} onPress={() => go('ChangePassword')}>
                  <Icon name="lock" size={16} color={glass.ink} /><Text style={styles.menuText}>Change password</Text>
                </Pressable>
                <Pressable style={(s) => [styles.menuItem, lit(s) && styles.menuHover]} onPress={() => void signOut()} testID="topbar-signout">
                  <Icon name="logout" size={16} color={glass.pink} /><Text style={[styles.menuText, { color: glass.pink }]}>Sign out</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.flex}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  side: { padding: 16, paddingRight: 0, alignSelf: 'stretch' }, // full window height; the menu scrolls inside
  main: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 16, zIndex: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14 },
  pillText: { fontSize: 14, color: glass.inkMuted },
  bell: { width: 46, height: 46, padding: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: glass.violet, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  user: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: glass.indigo, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  userName: { fontSize: 14, fontWeight: '700', color: glass.ink },
  userRole: { fontSize: 12, color: glass.inkMuted },
  menu: { position: 'absolute', top: 56, right: 0, width: 200, backgroundColor: '#fff', borderRadius: 14, padding: 6, boxShadow: '0px 12px 32px rgba(30,27,75,0.16)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 },
  menuHover: { backgroundColor: glass.canvas },
  menuText: { fontSize: 14, color: glass.ink, fontWeight: '600' },
});
