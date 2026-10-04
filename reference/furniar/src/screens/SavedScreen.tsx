import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { cm, getFurniture, useProducts } from '../data/furniture';
import { useWishlist } from '../store/wishlistStore';
import { useRooms } from '../store/roomStore';
import { Button } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function SavedScreen() {
  useProducts();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ids = useWishlist((s) => s.ids);
  const { designs, remove } = useRooms();

  const sections = [
    { title: 'My designs', kind: 'design', data: designs.map((d) => ({ key: d.id, id: d.id })) },
    { title: 'Saved furniture', kind: 'item', data: ids.map((id) => ({ key: id, id })) },
  ];

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 14 }}
      sections={sections}
      keyExtractor={(x) => x.key}
      renderSectionHeader={({ section }) => <Text style={s.h}>{section.title}</Text>}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? (
          <Text style={s.empty}>
            {section.kind === 'design'
              ? 'No designs yet. Place furniture in AR and tap Save design.'
              : 'Nothing saved. Tap Save for later on a product.'}
          </Text>
        ) : null
      }
      renderItem={({ item, section }) => {
        if (section.kind === 'design') {
          const d = designs.find((x) => x.id === item.id);
          if (!d) return null;
          return (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{d.name}</Text>
                <Text style={s.sub}>{d.items.length} pieces</Text>
              </View>
              <Button label="Open" variant="outline" onPress={() => nav.navigate('AR', { productId: d.items[0].productId, designId: d.id })} />
              <Button label="Delete" variant="danger" onPress={() => remove(d.id)} style={{ marginLeft: 8 }} />
            </View>
          );
        }
        const f = getFurniture(item.id);
        if (!f) return null;
        return (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{f.name}</Text>
              <Text style={s.sub}>{cm(f)}</Text>
            </View>
            <Button label="View" variant="outline" onPress={() => nav.navigate('Product', { id: f.id })} />
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 10, marginBottom: 8 },
  empty: { color: colors.muted, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  name: { color: colors.ink, fontWeight: '600' },
  sub: { color: colors.muted, marginTop: 2 },
});
