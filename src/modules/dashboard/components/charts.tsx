import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { glass } from '../../../shared/designSystem';
import { Icon, type IconName } from '../../../shared/ui/Icon';

// SVG text does not inherit the page font on web.
const font = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

// Smooth area chart with gridlines, axis labels and the last point highlighted.
export function AreaChart({ points, format, testID }: { points: { label: string; value: number }[]; format: (n: number) => string; testID?: string }) {
  const [width, setWidth] = useState(0);
  const H = 230, left = 56, right = 20, top = 64, bottom = 28;
  const max = Math.max(1, ...points.map((p) => p.value)) * 1.15;
  const w = Math.max(0, width - left - right);
  const h = H - top - bottom;
  const xy = points.map((p, i) => [left + (points.length > 1 ? (i * w) / (points.length - 1) : w / 2), top + h - (p.value / max) * h] as const);
  // Cubic curve through the points: control points sit halfway between neighbours.
  const line = xy.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = xy[i - 1];
    const mx = (px + x) / 2;
    return `C${mx},${py} ${mx},${y} ${x},${y}`;
  }).join(' ');
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${top + h} L${xy[0][0]},${top + h} Z` : '';
  const last = xy[xy.length - 1];
  const lastPoint = points[points.length - 1];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }} testID={testID}>
      {width > 0 ? (
        <Svg width={width} height={H}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={glass.indigo} stopOpacity={0.35} />
              <Stop offset="1" stopColor={glass.indigo} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <Line key={f} x1={left} x2={left + w} y1={top + h * (1 - f)} y2={top + h * (1 - f)} stroke={glass.line} strokeWidth={1} />
          ))}
          {[0, 0.5, 1].map((f) => (
            <SvgText fontFamily={font} key={f} x={left - 8} y={top + h * (1 - f) + 4} fontSize={11} fill={glass.inkMuted} textAnchor="end">{format(max * f)}</SvgText>
          ))}
          {points.map((p, i) => (
            <SvgText fontFamily={font} key={p.label} x={xy[i][0]} y={H - 8} fontSize={11} fill={glass.inkMuted} textAnchor="middle">{p.label}</SvgText>
          ))}
          <Path d={area} fill="url(#area)" />
          <Path d={line} stroke={glass.indigo} strokeWidth={2.5} fill="none" />
          {last ? (
            <>
              <Line x1={last[0]} x2={last[0]} y1={last[1]} y2={top + h} stroke={glass.indigo} strokeOpacity={0.3} strokeDasharray="4 4" />
              <Circle cx={last[0]} cy={last[1]} r={6} fill="#fff" stroke={glass.indigo} strokeWidth={3} />
            </>
          ) : null}
        </Svg>
      ) : null}
      {last && lastPoint && width > 0 ? (
        <View style={[styles.tip, { left: Math.min(width - 120, Math.max(0, last[0] - 60)), top: last[1] - 62 }]}>
          <Text style={styles.tipLabel}>{lastPoint.label}</Text>
          <Text style={styles.tipValue}>{format(lastPoint.value)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export type Slice = { label: string; value: number; color: string };

// Ring chart with the total in the middle and a legend beside it.
export function Donut({ slices, centerLabel, testID }: { slices: Slice[]; centerLabel: string; testID?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 70, SW = 26, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <View style={styles.donutRow} testID={testID}>
      <View style={styles.donut}>
        <Svg width={180} height={180} viewBox="0 0 180 180">
          <Circle cx={90} cy={90} r={R} stroke={glass.line} strokeWidth={SW} fill="none" />
          {total > 0
            ? slices.map((s) => {
              const len = (s.value / total) * C;
              const el = <Circle key={s.label} cx={90} cy={90} r={R} stroke={s.color} strokeWidth={SW} fill="none" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)" />;
              offset += len;
              return el;
            })
            : null}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={styles.donutTotal}>{total}</Text>
          <Text style={styles.muted}>{centerLabel}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <View style={styles.flex}>
              <Text style={styles.legendLabel}>{s.label}</Text>
              <Text style={styles.small}>{total ? `${Math.round((s.value / total) * 1000) / 10}%` : '0%'}</Text>
            </View>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Icon + label + proportional bar + value, one row per queue.
export function BarList({ rows, testID }: { rows: { label: string; value: number; display?: string; icon: IconName; color: string }[]; testID?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.bars} testID={testID}>
      {rows.map((r) => (
        <View key={r.label} style={styles.barRow}>
          <View style={[styles.barIcon, { backgroundColor: `${r.color}1F` }]}><Icon name={r.icon} size={16} color={r.color} /></View>
          <Text style={styles.barLabel} numberOfLines={1}>{r.label}</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${(r.value / max) * 100}%`, backgroundColor: r.color }]} /></View>
          <Text style={styles.barValue}>{r.display ?? r.value}</Text>
        </View>
      ))}
    </View>
  );
}

// Stacked tapering stages (largest at the top), with the share of the first stage on the right.
export function Funnel({ stages, format, testID }: { stages: { label: string; value: number; colors: [string, string] }[]; format: (n: number) => string; testID?: string }) {
  const [width, setWidth] = useState(0);
  const SH = 64, gap = 6;
  const fw = Math.min(width * 0.62, 340);
  const step = (fw * 0.33) / Math.max(1, stages.length); // bottom stage keeps a third of the width
  const base = stages[0]?.value || 0;
  return (
    <View style={styles.funnelRow} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID={testID}>
      {width > 0 ? (
        <Svg width={fw} height={stages.length * (SH + gap)}>
          <Defs>
            {stages.map((s, i) => (
              <LinearGradient key={s.label} id={`fun${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.colors[0]} />
                <Stop offset="1" stopColor={s.colors[1]} />
              </LinearGradient>
            ))}
          </Defs>
          {stages.map((s, i) => {
            const y = i * (SH + gap);
            const t = i * step, b = (i + 1) * step;
            return (
              <Polygon key={s.label} points={`${t},${y} ${fw - t},${y} ${fw - b},${y + SH} ${b},${y + SH}`} fill={`url(#fun${i})`} />
            );
          })}
          {stages.map((s, i) => (
            <SvgText fontFamily={font} key={`t${s.label}`} x={fw / 2} y={i * (SH + gap) + SH / 2 + 2} fontSize={17} fontWeight="700" fill="#fff" textAnchor="middle">{format(s.value)}</SvgText>
          ))}
          {stages.map((s, i) => (
            <SvgText fontFamily={font} key={`l${s.label}`} x={fw / 2} y={i * (SH + gap) + SH / 2 + 18} fontSize={11} fill="#fff" fillOpacity={0.9} textAnchor="middle">{s.label}</SvgText>
          ))}
        </Svg>
      ) : null}
      <View style={styles.funnelSide}>
        {stages.map((s) => (
          <View key={s.label} style={{ height: SH + gap, justifyContent: 'center' }}>
            <Text style={styles.legendValue}>{base ? `${Math.round((s.value / base) * 1000) / 10}%` : '—'}</Text>
            <Text style={styles.small}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { fontSize: 13, color: glass.inkMuted },
  small: { fontSize: 12, color: glass.inkMuted },
  tip: { position: 'absolute', width: 120, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, boxShadow: '0px 6px 18px rgba(76,70,180,0.15)' },
  tipLabel: { fontSize: 11, color: glass.inkMuted },
  tipValue: { fontSize: 14, fontWeight: '800', color: glass.ink },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  donut: { width: 180, height: 180 },
  donutCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  donutTotal: { fontSize: 28, fontWeight: '800', color: glass.ink },
  legend: { flexGrow: 1, minWidth: 160, gap: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  legendLabel: { fontSize: 14, color: glass.ink, fontWeight: '600' },
  legendValue: { fontSize: 15, fontWeight: '800', color: glass.ink },
  bars: { gap: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  barLabel: { width: 150, fontSize: 14, color: glass.ink },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: glass.line, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  barValue: { width: 70, textAlign: 'right', fontSize: 14, fontWeight: '700', color: glass.ink },
  funnelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  funnelSide: { flex: 1 },
});
