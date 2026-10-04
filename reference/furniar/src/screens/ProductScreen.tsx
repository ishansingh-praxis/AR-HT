import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cm, getFurniture, useProducts } from '../data/furniture';
import { checkFit } from '../utils/geometry';
import { Button } from '../components/ui';
import { useWishlist } from '../store/wishlistStore';
import { colors, formatPrice } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

const viewerHtml = (src: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script type="module" src="https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js"></script>
<style>html,body{margin:0;height:100%;background:#E7ECEA}model-viewer{width:100%;height:100%}</style></head>
<body><model-viewer src="${src}" camera-controls auto-rotate shadow-intensity="1"></model-viewer></body></html>`;

export default function ProductScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Product'>) {
  useProducts();
  const item = getFurniture(route.params.id);
  const liked = useWishlist((s) => (item ? s.ids.includes(item.id) : false));
  const toggle = useWishlist((s) => s.toggle);
  const [space, setSpace] = useState('');
  if (!item) return <Text style={{ padding: 20 }}>Product not found.</Text>;
  const { w } = item.dimensionsCm;
  const fit = Number(space) > 0 ? checkFit(w, Number(space)) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }}>
      {item.model3D ? (
        <View style={{ height: 300 }}><WebView originWhitelist={['*']} source={{ html: viewerHtml(item.model3D.url) }} style={{ backgroundColor: '#E7ECEA' }} /></View>
      ) : (
        <Image source={{ uri: item.images[0] }} style={{ height: 300, backgroundColor: colors.line }} resizeMode="contain" />
      )}
      <View style={s.body}>
        <Text style={s.name}>{item.name}</Text>
        {item.priceInr ? <Text style={s.price}>{formatPrice(item.priceInr)} <Text style={s.meta}>reference price</Text></Text> : null}
        <Text style={s.text}>{item.description}</Text>
        <Text style={s.meta}>Size: {cm(item)} (W × D × H){item.dimsConfidence === 'low' ? '. This size came from unclear source data: check it before relying on it.' : ''}</Text>
        {item.material ? <Text style={s.meta}>Material: {item.material}</Text> : null}
        {item.setSize ? <Text style={s.meta}>Sold as a set of {item.setSize}. The size above is for one item.</Text> : null}
        {item.modelStatus === 'proxy' ? <Text style={s.proxy}>A 3D model isn't ready for this product yet. In AR you'll see a box at its exact size, which is enough to judge fit and layout.</Text> : null}

        <View style={s.fitBox}>
          <Text style={s.fitTitle}>Will it fit?</Text>
          <TextInput value={space} onChangeText={(t) => setSpace(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Free wall or floor width in cm" placeholderTextColor={colors.muted} style={s.fitInput} />
          {fit?.status === 'fits' && <Text style={{ color: colors.accent, marginTop: 8 }}>Fits with {fit.spareCm} cm to spare.</Text>}
          {fit?.status === 'tight' && <Text style={{ color: colors.warn, marginTop: 8 }}>Fits, but only {fit.spareCm} cm to spare. Aim for at least 40 cm.</Text>}
          {fit?.status === 'no' && <Text style={{ color: colors.danger, marginTop: 8 }}>Too wide by {fit.shortByCm} cm. It is {w} cm wide.</Text>}
        </View>

        <Button label="Place in my room" onPress={() => navigation.navigate('AR', { productId: item.id })} style={{ marginTop: 18 }} />
        <Button label={liked ? 'Remove from saved' : 'Save for later'} variant="outline" onPress={() => toggle(item.id)} style={{ marginTop: 8 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 18 },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink },
  price: { fontSize: 18, color: colors.accent, marginTop: 4, fontWeight: '600' },
  text: { color: colors.ink, marginTop: 12, lineHeight: 21 },
  meta: { color: colors.muted, marginTop: 8, fontSize: 13 },
  proxy: { color: colors.warn, marginTop: 10, fontSize: 13, lineHeight: 19 },
  fitBox: { marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  fitTitle: { fontWeight: '700', color: colors.ink, marginBottom: 8 },
  fitInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, color: colors.ink },
});
