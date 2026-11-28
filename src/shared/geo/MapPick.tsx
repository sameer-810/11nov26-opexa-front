import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { colors } from '../designSystem';

type Props = { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void; testID?: string };

const MUMBAI = { lat: 19.076, lng: 72.8777 };

// OpenStreetMap + Leaflet in a sandboxed frame. Tap or drag the pin; the page and the frame talk by postMessage.
const page = (lat: number, lng: number, pin: boolean) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}</style></head><body><div id="m"></div><script>
var map = L.map('m').setView([${lat}, ${lng}], ${pin ? 16 : 11});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
var pin = null;
function place(lat, lng) {
  if (!pin) { pin = L.marker([lat, lng], { draggable: true }).addTo(map); pin.on('dragend', function () { var p = pin.getLatLng(); send(p.lat, p.lng); }); }
  else pin.setLatLng([lat, lng]);
}
function send(lat, lng) { parent.postMessage({ type: 'opexa-map-pick', lat: lat, lng: lng }, '*'); }
${pin ? `place(${lat}, ${lng});` : ''}
map.on('click', function (e) { place(e.latlng.lat, e.latlng.lng); send(e.latlng.lat, e.latlng.lng); });
addEventListener('message', function (e) { var d = e.data || {}; if (d.type === 'opexa-map-set') { place(d.lat, d.lng); map.setView([d.lat, d.lng], Math.max(map.getZoom(), 16)); } });
</script></body></html>`;

export function MapPick({ lat, lng, onPick, testID }: Props) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const has = lat != null && lng != null;
  // Built once: later position changes are sent to the map instead of reloading it.
  const doc = useMemo(() => page(has ? lat : MUMBAI.lat, has ? lng : MUMBAI.lng, has), []);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; lat?: number; lng?: number } | null;
      if (e.source !== frame.current?.contentWindow || d?.type !== 'opexa-map-pick' || typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      pickRef.current(d.lat, d.lng);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (has) frame.current?.contentWindow?.postMessage({ type: 'opexa-map-set', lat, lng }, '*');
  }, [has, lat, lng]);

  if (Platform.OS !== 'web') return <Text style={styles.note}>The map opens in the web app. On the phone, use Find on map or your current location.</Text>;
  return (
    <iframe
      ref={frame}
      title="Site location map"
      srcDoc={doc}
      sandbox="allow-scripts"
      data-testid={testID}
      onLoad={() => { if (has) frame.current?.contentWindow?.postMessage({ type: 'opexa-map-set', lat, lng }, '*'); }}
      style={{ width: '100%', height: 320, border: `1px solid ${colors.border}`, borderRadius: 12 }}
    />
  );
}

const styles = StyleSheet.create({ note: { fontSize: 13, color: colors.textMuted } });
