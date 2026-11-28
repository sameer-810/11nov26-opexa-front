import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/apiClient';
import { colors, radius, spacing } from '../designSystem';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/Banner';
import { geoApi, type GeoResult } from './geoApi';
import { MapPick } from './MapPick';

type Props = { address: string; lat: string; lng: string; onChange: (lat: string, lng: string) => void; testID: string };

const fix = (n: number) => n.toFixed(6);
const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

// Site / project location: find the typed address on the map, or tap the spot on the map. Fills latitude/longitude.
export function LocationPicker({ address, lat, lng, onChange, testID }: Props) {
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const find = async () => {
    setProblem(''); setResults(null);
    if (address.trim().length < 3) { setProblem('Type the site address first'); return; }
    setBusy(true);
    try {
      const list = await geoApi.search(address.trim());
      setResults(list);
      if (!list.length) setProblem('No place found for this address. Try a shorter address, or pick the spot on the map.');
    } catch (e) { setProblem(e instanceof ApiError ? e.message : 'Address search failed'); } finally { setBusy(false); }
  };
  const choose = (r: GeoResult) => { onChange(fix(r.lat), fix(r.lng)); setResults(null); setMapOpen(true); };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button title="Find address on map" variant="outline" onPress={find} loading={busy} testID={`${testID}-find`} />
        <Button title={mapOpen ? 'Hide map' : 'Select on map'} variant="outline" onPress={() => setMapOpen((o) => !o)} testID={`${testID}-map-toggle`} />
      </View>
      {problem ? <ErrorBanner message={problem} testID={`${testID}-problem`} /> : null}
      {results?.length ? (
        <View style={styles.list} testID={`${testID}-results`}>
          <Text style={styles.hint}>Choose the right place:</Text>
          {results.map((r, i) => (
            <Pressable key={`${r.lat},${r.lng}`} onPress={() => choose(r)} style={({ pressed }) => [styles.item, pressed && styles.pressed]} testID={`${testID}-result-${i}`}>
              <Text style={styles.itemText} numberOfLines={2}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {mapOpen ? (
        <>
          <Text style={styles.hint}>Tap the exact site spot, or drag the pin.</Text>
          <MapPick lat={num(lat)} lng={num(lng)} onPick={(a, b) => onChange(fix(a), fix(b))} testID={`${testID}-map`} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingVertical: 4 },
  hint: { fontSize: 13, color: colors.textMuted, paddingHorizontal: spacing.sm },
  item: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  pressed: { backgroundColor: colors.surfaceAlt },
  itemText: { fontSize: 14, color: colors.text },
});
