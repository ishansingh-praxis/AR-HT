import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProducts } from '../data/furniture';
import { ProductCard } from '../components/ProductCard';
import { recommend } from '../recommend/engine';
import { areaOf, useSettings } from '../store/settingsStore';
import { colors, ROOM_LABEL } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && { color: colors.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const products = useProducts();
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<string | null>(null);

  const roles = useMemo(() => [...new Set(products.map((p) => p.role))].sort(), [products]);
  const data = useMemo(
    () => products.filter((f) => (!role || f.role === role) && `${f.name} ${f.material} ${f.subcategory}`.toLowerCase().includes(query.trim().toLowerCase())),
    [products, role, query]
  );
  // With nothing placed yet, suggestions are the starting pieces for this kind of room that fit its size.
  const starters = useMemo(
    () => recommend(products, { roomType: settings.roomType, areaM2: areaOf(settings), placed: [], maxResults: 4 }),
    [products, settings.roomType, settings.scanned, settings.preset]
  );

  return (
    <View style={s.root}>
      <FlatList
        data={data}
        numColumns={2}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 10 }}
        ListHeaderComponent={
          <View>
            {starters.length > 0 && !query && !role && (
              <View style={{ marginBottom: 10 }}>
                <Text style={s.h}>Good starting pieces for your {ROOM_LABEL[settings.roomType].toLowerCase()}</Text>
                <FlatList
                  horizontal data={starters} keyExtractor={(r) => r.product.id} showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={{ width: 170 }}>
                      <ProductCard item={item.product} note={item.reasons[0]} onPress={() => nav.navigate('Product', { id: item.product.id })} />
                    </View>
                  )}
                />
              </View>
            )}
            <TextInput value={query} onChangeText={setQuery} placeholder="Search furniture" placeholderTextColor={colors.muted} style={s.search} />
            <View style={s.chips}>
              <Chip label="All" on={!role} onPress={() => setRole(null)} />
              {roles.map((r) => <Chip key={r} label={r.replace('-', ' ')} on={role === r} onPress={() => setRole(role === r ? null : r)} />)}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No furniture matches. Clear a filter to see more.</Text>}
        renderItem={({ item }) => <ProductCard item={item} onPress={() => nav.navigate('Product', { id: item.id })} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  h: { color: colors.ink, fontWeight: '700', fontSize: 15, marginHorizontal: 6, marginBottom: 4 },
  search: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: colors.ink, margin: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, margin: 4, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13, textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
