import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { glass } from '../../../shared/designSystem';
import { GlassCard } from '../../../shared/ui/Glass';
import { Icon, type IconName } from '../../../shared/ui/Icon';

// KPI card: tinted icon, label, big value, optional change vs last period.
export function StatCard({ icon, tint, label, value, delta, sub, onPress, testID }: {
  icon: IconName; tint: string; label: string; value: string; delta?: number | null; sub?: string; onPress?: () => void; testID?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.statWrap, pressed && styles.pressed]} accessibilityRole={onPress ? 'button' : undefined} testID={testID}>
      <GlassCard style={styles.stat}>
        <View style={[styles.iconTile, { backgroundColor: `${tint}1F` }]}><Icon name={icon} size={22} color={tint} /></View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        {delta !== undefined && delta !== null ? (
          <View style={styles.deltaRow}>
            <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} color={up ? glass.green : glass.pink} strokeWidth={2.4} />
            <Text style={[styles.delta, { color: up ? glass.green : glass.pink }]}>{Math.abs(delta)}%</Text>
          </View>
        ) : null}
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </GlassCard>
    </Pressable>
  );
}

// Titled glass panel with an icon and an optional action on the right.
export function Panel({ icon, title, action, onAction, children, style, testID }: {
  icon: IconName; title: string; action?: string; onAction?: () => void; children: ReactNode; style?: object; testID?: string;
}) {
  return (
    <GlassCard style={[styles.panel, style]} testID={testID}>
      <View style={styles.panelHead}>
        <View style={styles.panelIcon}><Icon name={icon} size={18} color={glass.indigo} /></View>
        <Text style={styles.panelTitle} accessibilityRole="header">{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="link" style={styles.action}>
            <Text style={styles.actionText}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </GlassCard>
  );
}

// Quick-access tile (every module the user can open).
export function Tile({ title, body, icon, tint, onPress, testID }: { title: string; body: string; icon: IconName; tint: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]} accessibilityRole="button" testID={testID}>
      <GlassCard style={styles.tile}>
        <View style={[styles.iconTileSm, { backgroundColor: `${tint}1F` }]}><Icon name={icon} size={18} color={tint} /></View>
        <View style={styles.flex}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.sub}>{body}</Text>
        </View>
        <Icon name="chevronRight" size={16} color={glass.inkMuted} />
      </GlassCard>
    </Pressable>
  );
}

const TONE = {
  paid: { bg: '#D1FAE5', fg: '#047857', label: 'Paid' },
  part: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Part paid' },
  unpaid: { bg: '#EDE9FE', fg: '#6D28D9', label: 'Unpaid' },
};
export function PayChip({ status }: { status: keyof typeof TONE }) {
  const t = TONE[status];
  return <View style={[styles.chip, { backgroundColor: t.bg }]}><Text style={[styles.chipText, { color: t.fg }]}>{t.label}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  statWrap: { flexGrow: 1, flexBasis: 220 },
  stat: { gap: 6, height: '100%' },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconTileSm: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 14, color: glass.inkMuted, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '800', color: glass.ink },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  delta: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 13, color: glass.inkMuted },
  panel: { gap: 16, flexGrow: 1, flexBasis: 380 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(91,91,239,0.10)', alignItems: 'center', justifyContent: 'center' },
  panelTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: glass.ink },
  action: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: glass.line },
  actionText: { fontSize: 13, color: glass.indigo, fontWeight: '600' },
  tileWrap: { flexGrow: 1, flexBasis: 280 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, height: '100%' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: glass.ink },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
});
