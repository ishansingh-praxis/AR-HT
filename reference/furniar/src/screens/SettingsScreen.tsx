import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../components/ui';
import { useSettings } from '../store/settingsStore';
import { useCatalogue } from '../store/catalogueStore';
import { colors, ROOM_LABEL } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { roomType, preset, scanned, setScanned } = useSettings();
  const source = useCatalogue((s) => s.source);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h}>Your room</Text>
      <View style={s.card}>
        <Text style={s.line}>Room type: {ROOM_LABEL[roomType]}</Text>
        <Text style={s.line}>Size: {scanned ? `${(scanned.widthCm / 100).toFixed(1)} × ${(scanned.depthCm / 100).toFixed(1)} m (${scanned.areaM2.toFixed(1)} m², scanned)` : preset === 'unknown' ? 'not set' : `${preset} (estimate)`}</Text>
        {scanned && scanned.rectangularity < 0.9 ? <Text style={s.warn}>This room is irregular, so fit checks use its bounding box and may be optimistic.</Text> : null}
        <Button label="Change room or size" variant="outline" onPress={() => nav.navigate('Welcome')} style={{ marginTop: 10 }} />
        {scanned ? <Button label="Forget scanned room" variant="outline" onPress={() => setScanned(null)} style={{ marginTop: 8 }} /> : null}
      </View>
      <Text style={s.h}>About</Text>
      <View style={s.card}>
        <Text style={s.line}>Catalogue source: {source === 'server' ? 'server' : source === 'cached' ? 'saved copy (offline)' : 'built-in'}</Text>
        <Text style={s.line}>Camera images stay on your phone. Only anonymous usage counts (such as "a suggestion was placed") can be sent to improve recommendations, and only when a server is configured.</Text>
        <Button label="Clear my saved data" variant="danger" style={{ marginTop: 10 }} onPress={() => Alert.alert('Clear saved data?', 'This removes your designs, saved items and scanned room from this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { const AS = (await import('@react-native-async-storage/async-storage')).default; await AS.clear(); Alert.alert('Cleared', 'Restart the app to finish.'); } }])} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: colors.ink, fontWeight: '700', fontSize: 16, marginTop: 10, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  line: { color: colors.ink, marginTop: 4, lineHeight: 20 },
  warn: { color: colors.warn, marginTop: 6, fontSize: 13 },
});
