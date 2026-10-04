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
<script>
const mv=document.getElementById('mv');
const say=(m)=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m);
mv.addEventListener('error',()=>say('error'));
mv.addEventListener('load',()=>say('ready'));
</script>
${opts.photo ? `<script>
mv.addEventListener('load',async()=>{try{
  const tex=await mv.createTexture(${JSON.stringify(opts.photo)});
  for(const m of mv.model.materials){ if(m.name==='dark') continue;
    m.pbrMetallicRoughness.setBaseColorFactor([1,1,1,1]); m.pbrMetallicRoughness.baseColorTexture.setTexture(tex); }
}catch(e){}});
</script>` : ''}</body></html>`;

/** The bundled proxy GLB for this product, inlined as a data: URI so the WebView needs no file access (it is only a few KB). */
function useProxyUri(p: Product) {
  const [state, setState] = useState<{ uri: string | null; failed: boolean }>({ uri: null, failed: false });
  const mod = p.proxy ? PROXY_ASSETS[`${p.proxy.template}-${p.proxy.color}`] : undefined;
  useEffect(() => {
    if (!mod || p.model3D) return;
    let live = true;
    (async () => {
      try {
        const asset = Asset.fromModule(mod);
        await asset.downloadAsync();
        const b64 = await new File(asset.localUri ?? asset.uri).base64();
        if (live) setState({ uri: `data:model/gltf-binary;base64,${b64}`, failed: false });
      } catch { if (live) setState({ uri: null, failed: true }); }
    })();
    return () => { live = false; };
  }, [mod, p.model3D]);
  return state;
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

/**
 * Product viewer: a spinning 3D "360°" view (real model, or true-size shape wrapped in the product photo) + photo gallery.
 * The tabs always show when there are photos. If the 3D view cannot start (no model, WebView error, or no answer within
 * 8 seconds) we fall back to the photos and say so, instead of leaving a blank box.
 * `onInteract(true)` is called while a finger is on the 3D view so the page does not scroll under it.
 */
export function Product360({ item, onInteract }: { item: Product; onInteract?: (active: boolean) => void }) {
  const [mode, setMode] = useState<Mode>('360');
  const [still, setStill] = useState(false);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  const proxy = useProxyUri(item);
  const photo = usePhotoData(item.model3D ? undefined : item.images[0]);
  const { w, d, h } = item.dimensionsCm;
  const html = useMemo(() => {
    if (item.model3D) return viewerHtml(item.model3D.url, { still });
    return proxy.uri ? viewerHtml(proxy.uri, { scale: `${w / 100} ${h / 100} ${d / 100}`, photo, still }) : null;
  }, [item.model3D, proxy.uri, photo, w, h, d, still]);
  const hasPhotos = item.images.length > 0;
  const noModel = !item.model3D && (!item.proxy || proxy.failed);
  const failed = broken || noModel;
  const showing360 = mode === '360' && !failed;

  // give the viewer a fair time to report back, then show the photos
  useEffect(() => {
    if (!html || ready || broken) return;
    const timer = setTimeout(() => setBroken(true), 8000);
    return () => clearTimeout(timer);
  }, [html, ready, broken]);

  return (
    <View>
      <View style={{ height: 320, backgroundColor: '#E7ECEA' }}>
        {showing360 ? (
          <>
            {html ? (
              <WebView
                key={photo ? 'photo' : 'plain'} originWhitelist={['*']} javaScriptEnabled domStorageEnabled nestedScrollEnabled
                source={{ html, baseUrl: '' }} style={{ backgroundColor: '#E7ECEA' }} accessibilityLabel={t('product360.rotating3dViewOf')}
                onMessage={(e) => { if (e.nativeEvent.data === 'ready') setReady(true); else if (e.nativeEvent.data === 'error') setBroken(true); }}
                onError={() => setBroken(true)} onHttpError={() => setBroken(true)}
                onTouchStart={() => onInteract?.(true)} onTouchEnd={() => onInteract?.(false)} onTouchCancel={() => onInteract?.(false)}
              />
            ) : null}
            {!ready ? <ActivityIndicator style={s.center} size="large" color={colors.accent} /> : null}
            {ready ? <Text style={s.tag}>{item.model3D ? t('p360.drag') : photo ? t('p360.photoWrap') : t('p360.shape')}</Text> : null}
          </>
        ) : (
          <>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {item.images.map((u, i) => <ProductImage key={u} uri={u} blurhash={i === 0 ? item.blurhash : undefined} contentFit="contain" style={{ width: 360, height: 320 }} label={t('p360.photoLabel', { name: item.name, n: i + 1, total: item.images.length })} />)}
            </ScrollView>
            {mode === '360' && failed ? <Text style={s.tag} accessibilityRole="alert">{t('p360.unavailable')}</Text> : null}
          </>
        )}
      </View>
      {hasPhotos ? (
        <View style={s.tabs}>
          {(['360', 'photos'] as Mode[]).map((m) => (
            <Pressable key={m} accessibilityRole="tab" accessibilityLabel={m === '360' ? t('p360.label360') : t('p360.labelPhotos')} accessibilityState={{ selected: mode === m }}
              onPress={() => { setMode(m); if (m === '360' && broken) { setBroken(false); setReady(false); } }} style={[s.tab, mode === m && s.tabOn]}>
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
  center: { position: 'absolute', alignSelf: 'center', top: 140 },
  tabs: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, backgroundColor: colors.bg },
  tab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginHorizontal: 5 },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
});
