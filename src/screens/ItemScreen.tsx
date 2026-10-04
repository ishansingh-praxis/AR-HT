import { t } from '../i18n';
import React, { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, HeartButton } from '../components/ui';
import { FitCalculator } from '../components/FitCalculator';
import { Product360 } from '../components/Product360';
import { getFurniture, sizeLabel, useProducts, variantLabel } from '../data/furniture';
import { colourVariants } from '../recommend/helpers';
import { useWishlist } from '../store/wishlistStore';
import { useSettings } from '../store/settingsStore';
import { track } from '../services/events';
import { isSaved } from '../utils/wishlist';
import { SHOW_PRICES } from '../config';
import { withUtm } from '../utils/links';
import { colors, formatPrice } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

export default function ItemScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Item'>) {
  const all = useProducts();
  const item = getFurniture(route.params.id);
  const saved = useWishlist((w) => (item ? isSaved(w.items, item.id) : false));
  const toggle = useWishlist((w) => w.toggle);
  const noAR = useSettings((s) => s.arSupported === false);
  useEffect(() => { if (item) track('item_viewed', { id: item.id }); }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return <Text style={{ padding: 20 }}>{t('item.thisItemIsNo')}</Text>;
  const variants = colourVariants(item, all);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Product360 item={item} />
      <View style={{ padding: 18 }}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.cat}>{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</Text>
          </View>
          <HeartButton saved={saved} onPress={() => { if (toggle(item.id)) track('wishlist_added', { id: item.id }); }} />
        </View>
        <View style={s.dims}>
          <Text style={s.dimLabel}>{t('item.realSizeWD')}</Text>
          <Text style={s.dimValue}>{sizeLabel(item)}</Text>
          {item.dimsConfidence === 'low' ? <Text style={s.warn}>This size needed guessing in HomeTown&apos;s data. Check it on hometown.in before you buy.</Text> : null}
          {item.setSize ? <Text style={s.dimLabel}>Sold as a set of {item.setSize}; the size above is for one piece.</Text> : null}
          {SHOW_PRICES && item.priceInr ? <Text style={s.dimLabel}>Reference price {formatPrice(item.priceInr)}{item.compareAtInr ? ` (was ${formatPrice(item.compareAtInr)})` : ''}</Text> : null}
        </View>
        <FitCalculator product={item} />
        {variants.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={s.dimLabel}>{t('item.otherColoursConfigurations')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {variants.map((v) => (
                <Pressable key={v.id} accessibilityLabel={t('item.show', { name: v.name })} onPress={() => navigation.replace('Item', { id: v.id })} style={s.var}><Text style={{ color: colors.ink }}>{variantLabel(v, item)}</Text></Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {item.material ? <Text style={s.body}>Material: {item.material}</Text> : null}
        {item.description ? <Text style={s.body}>{item.description}</Text> : null}
        {item.model3D || item.proxy ? (
          noAR
            ? <Button label={t('item.planView')} onPress={() => navigation.navigate('Plan', { productId: item.id })} style={{ marginTop: 18 }} />
            : <Button label={t('item.viewInMyRoom')} onPress={() => navigation.navigate('AR', { productId: item.id })} style={{ marginTop: 18 }} />
        ) : (
          <Text style={s.soon}>{item.sizeReview ? 'Placement is switched off until this size is checked against HomeTown\'s specification.' : 'The 3D model for this piece is being prepared.'}</Text>
        )}
        {noAR ? <Text style={s.soon}>{t('item.thisPhoneDoesNot')}</Text> : null}
        {!item.model3D && item.proxy ? <Text style={s.soon}>{t('item.inArThisIs')}</Text> : null}
        {item.retailerUrl ? (
          <Button label={t('item.viewOnHometown')} variant="outline" onPress={() => { track('retailer_link_opened', { id: item.id }); Linking.openURL(withUtm(item.retailerUrl!, 'item')); }} style={{ marginTop: 10 }} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink },
  cat: { color: colors.muted, marginTop: 4 },
  dims: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginTop: 16 },
  dimLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  dimValue: { color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 2 },
  warn: { color: colors.danger, marginTop: 6, fontSize: 12 },
    var: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8, marginTop: 6, backgroundColor: colors.surface },
  soon: { marginTop: 18, color: colors.muted, backgroundColor: colors.surface, padding: 14, borderRadius: 10, lineHeight: 20 },
  body: { color: colors.ink, marginTop: 12, lineHeight: 20 },
});
