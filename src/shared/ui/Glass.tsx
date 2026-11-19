import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { glass } from '../designSystem';

const web = Platform.OS === 'web';
// CSS-only effects: react-native-web passes them to the browser; phones ignore them.
const blur = (px: number) => (web ? ({ backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)` } as unknown as ViewStyle) : null);
const soften = web ? ({ filter: 'blur(70px)' } as unknown as ViewStyle) : null;

// Hover (web) or press (phone) highlight for Pressable styles; react-native-web adds `hovered`.
export const lit = (s: PressableStateCallbackType) => Boolean((s as { hovered?: boolean }).hovered || s.pressed);

// Frosted panel used by the dashboard, sidebar and top bar.
export function GlassCard({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[styles.card, blur(18), style]} testID={testID}>{children}</View>;
}

// Soft colour clouds behind the glass (web only; phones get the plain canvas colour).
export function Backdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.canvas]} pointerEvents="none">
      {web ? (
        <>
          <View style={[styles.blob, soften, { top: -120, left: -80, backgroundColor: '#C7D2FE' }]} />
          <View style={[styles.blob, soften, { top: '35%', right: -160, backgroundColor: '#DDD6FE' }]} />
          <View style={[styles.blob, soften, { bottom: -160, left: '30%', backgroundColor: '#BAE6FD' }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.panel,
    borderColor: glass.panelBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    boxShadow: glass.shadow,
  },
  canvas: { backgroundColor: glass.canvas, overflow: 'hidden' },
  blob: { position: 'absolute', width: 520, height: 520, borderRadius: 260, opacity: 0.7 },
});
