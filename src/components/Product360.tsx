import { t } from '../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProductImage } from './ProductImage';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { PROXY_ASSETS } from '../data/proxyAssets';
import { MODEL_VIEWER_JS } from '../assets/modelViewerSource';
import { colors } from '../theme';
import type { Product } from '../types/furniture';

type Mode = '360' | 'photos';

/**
 * model-viewer page that spins the model. `scale` (metres "w h d") stretches a simplified proxy to the real size.
 * `photo` is a data: URI of the product picture, wrapped onto the shape's body so the piece looks like the product.
 * The wrap is an approximation (the same photo is mapped on every face): real GLB models need no photo.
 */
export const viewerHtml = (src: string, opts: { scale?: string; photo?: string; still?: boolean } = {}) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script type="module">${MODEL_VIEWER_JS}</script>
<style>html,body{margin:0;height:100%;background:#E7ECEA}model-viewer{width:100%;height:100%;--poster-color:#E7ECEA}</style></head>
<body><model-viewer id="mv" src="${src}" ${opts.scale ? `scale="${opts.scale}"` : ''} camera-controls ${opts.still ? '' : 'auto-rotate'} auto-rotate-delay="0"
 rotation-per-second="40deg" interaction-prompt="none" shadow-intensity="1" exposure="1.1"></model-viewer>
${opts.photo ? `<script>
const mv=document.getElementById('mv');
mv.addEventListener('load',async()=>{try{
  const tex=await mv.createTexture(${JSON.stringify(opts.photo)});
  for(const m of mv.model.materials){ if(m.name==='dark') continue;
    m.pbrMetallicRoughness.setBaseColorFactor([1,1,1,1]); m.pbrMetallicRoughness.baseColorTexture.setTexture(tex); }
}catch(e){}});
</script>` : ''}</body></html>`;

/** Local file URI of the bundled proxy GLB for this product. */
function useProxyUri(p: Product) {
  const [uri, setUri] = useState<string | null>(null);
  const mod = p.proxy ? PROXY_ASSETS[`${p.proxy.template}-${p.proxy.color}`] : undefined;
  useEffect(() => {
    if (!mod || p.model3D) return;
    const asset = Asset.fromModule(mod);
    asset.downloadAsync().then(() => setUri(asset.localUri ?? asset.uri)).catch(() => setUri(null));
  }, [mod, p.model3D]);
  return uri;
}

/** Downloads the product photo once (cached on disk) and returns it as a data: URI, which avoids web CORS limits. */
function usePhotoData(url?: string) {
  const [loaded, setLoaded] = useState<{ url: string; data: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    (async () => {
      try {
        const dir = new Directory(Paths.cache, 'photos');
        if (!dir.exists) dir.create();
        const name = url.replace(/[^a-z0-9]/gi, '').slice(-60) + '.jpg';
        let file = new File(dir, name);
        if (!file.exists) file = await File.downloadFileAsync(url, file);
        const b64 = await file.base64();
        if (live) setLoaded({ url, data: `data:image/jpeg;base64,${b64}` });
      } catch { /* offline or blocked: the plain coloured shape is still shown */ }
    })();
    return () => { live = false; };
  }, [url]);
  return loaded && loaded.url === url ? loaded.data : undefined;
}

/** Product viewer: a spinning 3D "360°" view (real model, or true-size shape wrapped in the product photo) + photo gallery. */
export function Product360({ item }: { item: Product }) {
  const [mode, setMode] = useState<Mode>('360');
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  const proxyUri = useProxyUri(item);
  const photo = usePhotoData(item.model3D ? undefined : item.images[0]);
  const { w, d, h } = item.dimensionsCm;
  const html = useMemo(() => {
    if (item.model3D) return viewerHtml(item.model3D.url, { still });
    return proxyUri ? viewerHtml(proxyUri, { scale: `${w / 100} ${h / 100} ${d / 100}`, photo, still }) : null;
  }, [item.model3D, proxyUri, photo, w, h, d, still]);
  const has3D = !!html;

  return (
    <View>
      <View style={{ height: 320, backgroundColor: '#E7ECEA' }}>
        {mode === '360' && has3D ? (
          <>
            <WebView
              key={photo ? 'photo' : 'plain'} originWhitelist={['*']} allowFileAccess allowFileAccessFromFileURLs allowUniversalAccessFromFileURLs
              source={{ html: html!, baseUrl: '' }} style={{ backgroundColor: '#E7ECEA' }} accessibilityLabel={t('product360.rotating3dViewOf')}
            />
            <Text style={s.tag}>
              {item.model3D ? t('p360.drag') : photo ? t('p360.photoWrap') : t('p360.shape')}
            </Text>
            {!item.model3D && item.images[0] && !photo ? <ActivityIndicator style={s.spin} color={colors.accent} /> : null}
          </>
        ) : (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {item.images.map((u, i) => <ProductImage key={u} uri={u} blurhash={i === 0 ? item.blurhash : undefined} contentFit="contain" style={{ width: 360, height: 320 }} label={t('p360.photoLabel', { name: item.name, n: i + 1, total: item.images.length })} />)}
          </ScrollView>
        )}
      </View>
      {has3D && item.images.length > 0 ? (
        <View style={s.tabs}>
          {(['360', 'photos'] as Mode[]).map((m) => (
            <Pressable key={m} accessibilityRole="tab" accessibilityLabel={m === '360' ? t('p360.label360') : t('p360.labelPhotos')} accessibilityState={{ selected: mode === m }}
              onPress={() => setMode(m)} style={[s.tab, mode === m && s.tabOn]}>
              <Text style={[s.tabText, mode === m && { color: colors.accentInk }]}>{m === '360' ? t('p360.tab360') : t('p360.tabPhotos', { count: item.images.length })}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tag: { position: 'absolute', left: 12, bottom: 10, color: colors.muted, fontSize: 11, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  spin: { position: 'absolute', right: 14, bottom: 12 },
  tabs: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, backgroundColor: colors.bg },
  tab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginHorizontal: 5 },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
});
