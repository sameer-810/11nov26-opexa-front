import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { glass } from '../../../shared/designSystem';
import { formatDateTime } from '../../../shared/format';
import { lit } from '../../../shared/ui/Glass';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import type { AppNotification } from '../../notification/api/notificationApi';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

// Phone header: avatar, greeting, company, role; bell and sign-out on the right.
export function MobileHeader({ name, welcome, company, userLine, unread, onBell, onSignOut }: {
  name?: string; welcome: string; company?: string; userLine: string; unread: number; onBell: () => void; onSignOut: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.welcome} testID="dashboard-welcome">{welcome}</Text>
        <Text style={styles.company} numberOfLines={1} accessibilityRole="header" testID="dashboard-company">{company}</Text>
        <Text style={styles.userLine} numberOfLines={1} testID="dashboard-user">{userLine}</Text>
      </View>
      <Pressable onPress={onBell} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} testID="header-bell">
        <Icon name="bell" size={20} color={glass.ink} />
        {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
      </Pressable>
      <Pressable onPress={onSignOut} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Sign out" testID="signout">
        <Icon name="logout" size={20} color={glass.ink} />
      </Pressable>
    </View>
  );
}

// Thin white trend line for the hero card.
function Sparkline({ values }: { values: number[] }) {
  const [w, setW] = useState(0);
  const H = 70;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length > 1 ? (i * w) / (values.length - 1) : w / 2, H - 6 - (v / max) * (H - 14)] as const);
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `C${(pts[i - 1][0] + x) / 2},${pts[i - 1][1]} ${(pts[i - 1][0] + x) / 2},${y} ${x},${y}`)).join(' ');
  return (
    <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && values.length ? (
        <Svg width={w} height={H}>
          <Path d={`${d} L${w},${H} L0,${H} Z`} fill="#ffffff" fillOpacity={0.12} />
          <Path d={d} stroke="#ffffff" strokeWidth={2.5} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}

export type HeroChip = { label: string; value: string; tone?: 'up' | 'down' };

// Gradient summary card (the "balance" card of the phone dashboard).
export function HeroCard({ label, value, sub, trend, chips, testID }: { label: string; value: string; sub?: string; trend?: number[]; chips: HeroChip[]; testID?: string }) {
  return (
    <View style={styles.hero} testID={testID}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#4F46E5" />
            <Stop offset="1" stopColor="#2563EB" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
      </Svg>
      <Text style={styles.heroLabel}>{label}</Text>
      <Text style={styles.heroValue}>{value}</Text>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
      {trend && trend.some((v) => v > 0) ? <Sparkline values={trend} /> : <View style={{ height: 12 }} />}
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c.label} style={styles.chip}>
            <Text style={styles.chipLabel} numberOfLines={1}>{c.label}</Text>
            <Text style={[styles.chipValue, c.tone === 'up' && { color: glass.green }, c.tone === 'down' && { color: glass.pink }]} numberOfLines={1}>{c.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ICON_FOR: [RegExp, IconName, string][] = [
  [/requisition|request|overBoq/i, 'clipboard', glass.indigo],
  [/lot|dispatch|deliver/i, 'truck', glass.sky],
  [/invoice|billing|receipt/i, 'receipt', glass.violet],
  [/approval/i, 'check', glass.green],
  [/service|ticket|handover|amc|warranty/i, 'tool', glass.amber],
  [/bg|guarantee|retention|commitment/i, 'shield', glass.pink],
  [/return/i, 'undo', glass.violet],
  [/stock|material/i, 'box', glass.amber],
];

// Recent notifications as transaction-style rows.
export function ActivityList({ items, onOpen, testID }: { items: AppNotification[]; onOpen: (n: AppNotification) => void; testID?: string }) {
  if (!items.length) return <Text style={styles.empty} testID={testID}>Nothing new. You are up to date.</Text>;
  return (
    <View style={styles.card} testID={testID}>
      {items.map((n, i) => {
        const [, icon, tint] = ICON_FOR.find(([re]) => re.test(n.type)) ?? [/./, 'bell' as IconName, glass.inkMuted];
        return (
          <Pressable key={n.id} onPress={() => onOpen(n)} style={(s) => [styles.row, i > 0 && styles.rowBorder, lit(s) && styles.rowLit]} accessibilityRole="button" testID={`activity-${i}`}>
            <View style={[styles.rowIcon, { backgroundColor: `${tint}1F` }]}><Icon name={icon} size={18} color={tint} /></View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{formatDateTime(n.createdAt)}</Text>
            </View>
            {n.read ? <Icon name="chevronRight" size={16} color={glass.inkMuted} /> : <View style={styles.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section} accessibilityRole="header">{children}</Text>
      {action && onAction ? <Pressable onPress={onAction} accessibilityRole="link"><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: glass.indigo, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  welcome: { fontSize: 13, color: glass.inkMuted },
  company: { fontSize: 18, fontWeight: '800', color: glass.ink },
  userLine: { fontSize: 12, color: glass.inkMuted },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', boxShadow: glass.shadow },
  badge: { position: 'absolute', top: 5, right: 5, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: glass.violet, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  hero: { borderRadius: 24, padding: 20, overflow: 'hidden', boxShadow: '0px 14px 30px rgba(37,99,235,0.30)' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 },
  chipLabel: { fontSize: 11, color: glass.inkMuted, fontWeight: '600' },
  chipValue: { fontSize: 15, fontWeight: '800', color: glass.ink, marginTop: 2 },
  card: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 14, boxShadow: glass.shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderColor: glass.line },
  rowLit: { opacity: 0.7 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: glass.ink },
  rowSub: { fontSize: 12, color: glass.inkMuted, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: glass.indigo },
  empty: { fontSize: 14, color: glass.inkMuted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 17, fontWeight: '800', color: glass.ink },
  sectionAction: { fontSize: 13, color: glass.indigo, fontWeight: '700' },
});
