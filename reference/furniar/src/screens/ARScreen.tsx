import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Viro3DObject, ViroAmbientLight, ViroARScene, ViroARSceneNavigator, ViroBox, ViroDirectionalLight,
  ViroMaterials, ViroPolyline, ViroQuad, ViroSphere, ViroText, ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import { SAMPLE_ROOMS, getFurniture, getRoom, useProducts } from '../data/furniture';
import { useRooms } from '../store/roomStore';
import { useWishlist } from '../store/wishlistStore';

import { areaOf, useSettings } from '../store/settingsStore';
import { Button } from '../components/ui';
import { collidingUids, rotateLayout } from '../utils/geometry';
import { layoutFits, placeLayout, roomFromCorners, RoomBox } from '../utils/room';
import { recommend } from '../recommend/engine';
import { flushEvents, track } from '../services/events';
import { colors } from '../theme';
import type { PlacedItem } from '../types/furniture';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Vec3 = [number, number, number];

ViroMaterials.createMaterials({
  reticle: { diffuseColor: '#FFFFFFCC', lightingModel: 'Constant' },
  ring: { diffuseColor: '#2F6F5ECC', lightingModel: 'Constant' },
  ringBad: { diffuseColor: '#D8402FCC', lightingModel: 'Constant' },
  outline: { diffuseColor: '#FFD23F', lightingModel: 'Constant' },
});
const made = new Set<string>();
/** One material per colour, created on first use. */
const matFor = (hex: string) => {
  const key = `c${hex.replace('#', '')}`;
  if (!made.has(key)) { ViroMaterials.createMaterials({ [key]: { diffuseColor: hex, lightingModel: 'Blinn' } }); made.add(key); }
  return key;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const short = (n: string) => n.split(' ').slice(0, 2).join(' ');

interface SceneProps {
  items: PlacedItem[];
  selectedId: string | null;
  colliding: string[];
  corners: Vec3[];
  closed: boolean;
  onHit: (pos: Vec3 | null) => void;
  onSelect: (uid: string) => void;
  onUpdate: (uid: string, patch: Partial<PlacedItem>) => void;
  onTracking: (ok: boolean) => void;
}

function PlacementScene(props: any) {
  const { items, selectedId, colliding, corners, closed, onHit, onSelect, onUpdate, onTracking } = props.sceneNavigator.viroAppProps as SceneProps;
  const [reticle, setReticle] = useState<Vec3 | null>(null);
  const [light, setLight] = useState({ intensity: 900, color: '#FFFFFF' });
  const last = useRef<Vec3 | null>(null);
  const base = useRef<Record<string, { scale: number; rot: number }>>({});

  // Per-frame hit test from the screen centre. Only update state when it moves >1 cm, or the scene re-renders at camera rate.
  const onCameraARHitTest = (e: any) => {
    const results: any[] = e.hitTestResults ?? [];
    const hit =
      results.find((r) => r.type === 'ExistingPlaneUsingExtent' || r.type === 'ExistingPlane') ??
      results.find((r) => r.type === 'EstimatedHorizontalPlane');
    const pos: Vec3 | null = hit ? (hit.transform.position as Vec3) : null;
    const prev = last.current;
    const moved = !!pos !== !!prev || (pos && prev && Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]) > 0.01);
    if (moved) { last.current = pos; setReticle(pos); onHit(pos); }
  };
  const grab = (it: PlacedItem) => (base.current[it.uid] ??= { scale: it.scale, rot: it.rotationY });

  const outline: Vec3[] = corners.length > 1 ? [...corners.map((c) => [c[0], c[1] + 0.01, c[2]] as Vec3), ...(closed ? [[corners[0][0], corners[0][1] + 0.01, corners[0][2]] as Vec3] : [])] : [];

  return (
    <ViroARScene
      onCameraARHitTest={onCameraARHitTest}
      onTrackingUpdated={(state: number) => onTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL)}
      onAmbientLightUpdate={(u: { intensity: number; color: string }) =>
        // Follow the estimate only when sane and >10% different, to avoid flicker.
        setLight((cur) => (u.intensity >= 200 && u.intensity <= 3000 && Math.abs(u.intensity - cur.intensity) / cur.intensity > 0.1 ? { intensity: u.intensity, color: u.color || cur.color } : cur))
      }
    >
      <ViroAmbientLight color={light.color} intensity={light.intensity} />
      {items.length > 0 && (
        <ViroDirectionalLight
          color="#FFFFFF" intensity={600} direction={[0.3, -1, -0.4]} castsShadow shadowOpacity={0.5} shadowMapSize={1024}
          shadowOrthographicSize={5} shadowNearZ={0.1} shadowFarZ={7}
          shadowOrthographicPosition={[items[0].position[0] - 0.9, items[0].position[1] + 3, items[0].position[2] + 1.2]}
        />
      )}
      {reticle && <ViroQuad position={reticle} rotation={[-90, 0, 0]} width={0.22} height={0.22} materials={['reticle']} />}

      {corners.map((c, i) => <ViroSphere key={`c${i}`} position={[c[0], c[1] + 0.03, c[2]]} radius={0.035} materials={['outline']} />)}
      {outline.length > 1 && <ViroPolyline points={outline} thickness={0.012} materials={['outline']} />}

      {items.map((it) => {
        const p = getFurniture(it.productId);
        if (!p) return null;
        const { w, d, h } = p.dimensionsCm;
        const bad = colliding.includes(it.uid);
        const handlers = {
          dragType: 'FixedToWorld' as const,
          onClickState: (state: number) => state === 3 && onSelect(it.uid),
          onDrag: (pos: number[]) => onUpdate(it.uid, { position: [pos[0], it.position[1], pos[2]] }),
          onPinch: (state: number, factor: number) => { if (state === 1) delete base.current[it.uid]; onUpdate(it.uid, { scale: clamp(grab(it).scale * factor, 0.3, 3) }); },
          onRotate: (state: number, factor: number) => { if (state === 1) delete base.current[it.uid]; onUpdate(it.uid, { rotationY: grab(it).rot - factor }); },
        };
        return (
          <React.Fragment key={it.uid}>
            <ViroQuad position={[it.position[0], it.position[1] - 0.001, it.position[2]]} rotation={[-90, 0, 0]} width={3 * it.scale} height={3 * it.scale} arShadowReceiver />
            {(selectedId === it.uid || bad) && (
              <ViroQuad position={[it.position[0], it.position[1] + 0.003, it.position[2]]} rotation={[-90, 0, 0]} width={Math.max(w, d) / 100 * 1.15 * it.scale} height={Math.max(w, d) / 100 * 1.15 * it.scale} materials={[bad ? 'ringBad' : 'ring']} />
            )}
            {p.model3D ? (
              <Viro3DObject
                source={{ uri: p.model3D.url }} type="GLB" position={it.position} rotation={[0, it.rotationY, 0]} scale={[it.scale, it.scale, it.scale]}
                {...handlers} onError={() => console.warn('Failed to load model', p.model3D?.url)}
              />
            ) : (
              <>
                {/* No GLB yet: a box at the product's exact size, so fit and layout can still be judged. */}
                <ViroBox
                  position={[it.position[0], it.position[1] + (h / 200) * it.scale, it.position[2]]} rotation={[0, it.rotationY, 0]} scale={[it.scale, it.scale, it.scale]}
                  width={w / 100} length={d / 100} height={h / 100} materials={[matFor(p.colors[0]?.hex ?? '#B8C4C0')]} {...handlers}
                />
                <ViroText
                  text={short(p.name)} position={[it.position[0], it.position[1] + (h / 100) * it.scale + 0.12, it.position[2]]}
                  width={1.4} height={0.3} transformBehaviors={['billboardY']} style={{ fontSize: 22, color: '#FFFFFF', textAlignVertical: 'center', textAlign: 'center' }}
                />
              </>
            )}
          </React.Fragment>
        );
      })}
    </ViroARScene>
  );
}

export default function ARScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'AR'>) {
  const products = useProducts();
  const insets = useSafeAreaInsets();
  const navRef = useRef<ViroARSceneNavigator>(null);
  const hit = useRef<Vec3 | null>(null);
  const shown = useRef(new Set<string>());
  const settings = useSettings();
  const favorites = useWishlist((s) => s.ids);
  const saveDesign = useRooms((s) => s.save);
  const design = useRooms((s) => s.designs.find((d) => d.id === route.params.designId));

  const [mode, setMode] = useState<'place' | 'scan'>(route.params.mode === 'scan' ? 'scan' : 'place');
  const [corners, setCorners] = useState<Vec3[]>([]);
  const [room, setRoom] = useState<RoomBox | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasSurface, setHasSurface] = useState(false);
  const [tracking, setTracking] = useState(true);
  const [occlusion, setOcclusion] = useState(false);
  const [tab, setTab] = useState<'suggested' | 'all' | 'rooms'>(route.params.roomId ? 'rooms' : 'suggested');
  const [productId, setProductId] = useState(route.params.productId ?? products[0]?.id ?? '');
  const [layoutId, setLayoutId] = useState<string | null>(route.params.roomId ?? null);
  const [layout, setLayout] = useState<{ pivot: [number, number]; aligned: boolean; k: number } | null>(null);
  const [pendingDesign, setPendingDesign] = useState(!!design);

  const product = getFurniture(productId);
  const selected = items.find((i) => i.uid === selectedId) ?? null;
  const layoutDef = layoutId ? getRoom(layoutId) : undefined;

  useEffect(() => { track('ar_opened', { scan: route.params.mode === 'scan' }); return () => { flushEvents(); }; }, []);

  const onHit = useCallback((pos: Vec3 | null) => { hit.current = pos; setHasSurface(!!pos); }, []);
  const onUpdate = useCallback((uid: string, patch: Partial<PlacedItem>) => setItems((cur) => cur.map((i) => (i.uid === uid ? { ...i, ...patch } : i))), []);

  const suggestions = useMemo(
    () => recommend(products, { roomType: settings.roomType, areaM2: areaOf(settings), favorites, placed: items.flatMap((i) => { const p = getFurniture(i.productId); return p ? [{ product: p, item: i }] : []; }) }),
    [products, items, settings.roomType, settings.scanned, settings.preset, favorites]
  );
  useEffect(() => {
    for (const r of suggestions) if (!shown.current.has(r.product.id)) { shown.current.add(r.product.id); track('rec_shown', { productId: r.product.id, role: r.product.role }); }
  }, [suggestions]);

  const colliding = useMemo(() => [...collidingUids(items, getFurniture)], [items, products]);
  const sceneProps = useMemo<SceneProps>(
    () => ({ items, selectedId, colliding, corners, closed: !!room, onHit, onSelect: setSelectedId, onUpdate, onTracking: setTracking }),
    [items, selectedId, colliding, corners, room, onHit, onUpdate]
  );

  // ---- scanning ----
  const markCorner = () => { if (hit.current) setCorners((c) => [...c, hit.current as Vec3]); };
  const finishScan = () => {
    const r = roomFromCorners(corners.map((c) => [c[0], c[2]]));
    if (!r || r.areaM2 < 1.5) return Alert.alert("That's too small to be a room", 'Mark the corners where the walls meet the floor, going around the room.');
    setRoom(r);
    settings.setScanned({ widthCm: Math.round(r.widthCm), depthCm: Math.round(r.depthCm), areaM2: Math.round(r.areaM2 * 10) / 10, rectangularity: Math.round(r.rectangularity * 100) / 100, at: Date.now() });
    track('room_scanned', { corners: r.corners, areaM2: Math.round(r.areaM2), rectangular: r.rectangularity >= 0.9 });
    setMode('place');
    if (r.rectangularity < 0.9) Alert.alert('Irregular room', 'This room is not a simple rectangle, so sizes use its bounding box and may be optimistic.');
  };

  // ---- placing ----
  const floorY = () => (corners.length ? corners.reduce((s, c) => s + c[1], 0) / corners.length : hit.current?.[1] ?? 0);

  const placeSample = () => {
    if (!layoutDef) return;
    const anchor = layoutDef.pieces.find((p) => p.anchor) ?? layoutDef.pieces[0];
    let box: RoomBox, aligned: boolean, y: number;
    if (room) {
      box = room; aligned = true; y = floorY();
      if (!layoutFits(layoutDef.roomCm, room, 0)) {
        return Alert.alert('Bigger than your room', `This design needs ${(layoutDef.roomCm.w / 100).toFixed(1)} × ${(layoutDef.roomCm.d / 100).toFixed(1)} m and your room is ${(room.widthCm / 100).toFixed(1)} × ${(room.depthCm / 100).toFixed(1)} m. Place it anyway?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Place anyway', onPress: () => commit(box, true, y) }]);
      }
    } else {
      if (!hit.current) return;
      // No scan: put the anchor piece where the dot is, and keep the layout's shape.
      const dx = (anchor.x - layoutDef.roomCm.w / 2) / 100, dz = (anchor.z - layoutDef.roomCm.d / 2) / 100;
      box = { widthCm: layoutDef.roomCm.w, depthCm: layoutDef.roomCm.d, areaM2: 0, rectangularity: 1, centre: [hit.current[0] - dx, hit.current[2] - dz], yawDeg: 0, corners: 4 };
      aligned = false; y = hit.current[1];
    }
    commit(box, aligned, y);
  };
  const commit = (box: RoomBox, aligned: boolean, y: number) => {
    if (!layoutDef) return;
    const placed = placeLayout(layoutDef, box, 0).map((i) => ({ ...i, position: [i.position[0], y, i.position[2]] as Vec3 }));
    setItems((cur) => [...cur.filter((i) => !i.uid.startsWith('L')), ...placed]);
    const a = layoutDef.pieces.findIndex((p) => p.anchor);
    setLayout({ pivot: aligned ? box.centre : [placed[Math.max(a, 0)].position[0], placed[Math.max(a, 0)].position[2]], aligned, k: 0 });
    setSelectedId(null);
    track('sample_room_placed', { roomId: layoutDef.id, aligned });
  };
  const turnLayout = () => {
    if (!layout || !layoutDef) return;
    setItems((cur) => [...cur.filter((i) => !i.uid.startsWith('L')), ...rotateLayout(cur.filter((i) => i.uid.startsWith('L')), layout.pivot, 90)]);
    setLayout({ ...layout, k: layout.k + 1 });
  };

  const place = () => {
    const at = hit.current;
    if (!at) return;
    const stamp = Date.now();
    if (pendingDesign && design) {
      setItems(design.items.map((d, n) => ({ uid: `${stamp}-${n}`, productId: d.productId, position: [at[0] + d.offset[0], at[1] + d.offset[1], at[2] + d.offset[2]] as Vec3, rotationY: d.rotationY, scale: d.scale })));
      setPendingDesign(false);
      return;
    }
    if (!product) return;
    const item: PlacedItem = { uid: String(stamp), productId, position: at, rotationY: 0, scale: 1 };
    setItems((cur) => [...cur, item]);
    setSelectedId(item.uid);
    const rank = suggestions.findIndex((r) => r.product.id === productId);
    track('piece_placed', { productId, role: product.role });
    if (rank >= 0) track('rec_placed', { productId, rank });
  };
  const remove = () => {
    const p = selected && getFurniture(selected.productId);
    if (p) track('piece_removed', { productId: p.id, wasRecommended: suggestions.some((r) => r.product.id === p.id) });
    setItems((cur) => cur.filter((i) => i.uid !== selectedId));
    setSelectedId(null);
  };
  const save = () => {
    if (items.length === 0) return Alert.alert('Nothing to save', 'Place at least one piece first.');
    const o = items[0].position;
    saveDesign({ items: items.map((i) => ({ productId: i.productId, offset: [i.position[0] - o[0], i.position[1] - o[1], i.position[2] - o[2]] as Vec3, rotationY: i.rotationY, scale: i.scale })) });
    track('design_saved', { pieces: items.length });
    Alert.alert('Design saved', 'Find it under Designs. Reopening places it relative to wherever you tap.');
  };
  const photo = async () => {
    const r = await navRef.current?._takeScreenshot(`furni-${Date.now()}`, true);
    track('photo_taken', { ok: !!r?.success });
    Alert.alert(r?.success ? 'Saved to Photos' : 'Could not take photo', r?.success ? '' : 'Check photo permissions and try again.');
  };

  // ---- UI text ----
  const fitsNow = room && layoutDef ? layoutFits(layoutDef.roomCm, room, layout?.k ?? 0) : null;
  const status =
    mode === 'scan' ? (corners.length === 0 ? 'Stand in a corner and aim the dot at the floor where two walls meet.' : `${corners.length} corner${corners.length > 1 ? 's' : ''} marked. Walk to the next corner.`)
    : !tracking ? 'Tracking lost. Move slowly and point at the floor or textured surfaces.'
    : colliding.length > 0 ? 'Pieces are overlapping. Drag one clear of the red outline.'
    : hasSurface ? 'Floor found. Aim the dot where you want it.' : 'Move your phone slowly to scan the floor.';
  const warn = mode === 'place' && (!tracking || colliding.length > 0);
  const list = tab === 'suggested' ? suggestions.map((r) => r.product) : products;
  const reason = tab === 'suggested' ? suggestions.find((r) => r.product.id === productId)?.reasons[0] ?? suggestions[0]?.reasons[0] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ViroARSceneNavigator
        ref={navRef} autofocus shadowsEnabled pbrEnabled hdrEnabled occlusionMode={occlusion ? 'depthBased' : 'disabled'}
        initialScene={{ scene: PlacementScene as unknown as () => React.JSX.Element }} viroAppProps={sceneProps} style={{ flex: 1 }}
      />

      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => navigation.goBack()} style={s.pill} accessibilityRole="button"><Text style={s.pillText}>Close</Text></Pressable>
          {mode === 'place' && <Pressable onPress={() => setOcclusion((v) => !v)} style={[s.pill, { marginLeft: 8 }]} accessibilityRole="button"><Text style={s.pillText}>Depth occlusion: {occlusion ? 'on' : 'off'}</Text></Pressable>}
        </View>
        <Text style={[s.status, warn && { backgroundColor: 'rgba(179,64,47,0.9)' }]}>{status}</Text>
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode === 'scan' ? (
            <View>
              <Button label="Mark corner" onPress={markCorner} disabled={!hasSurface} />
              <View style={s.row}>
                <Button label="Undo" variant="outline" onPress={() => setCorners((c) => c.slice(0, -1))} disabled={!corners.length} style={s.flex} />
                <Button label={`Done (${corners.length})`} variant="outline" onPress={finishScan} disabled={corners.length < 3} style={s.flex} />
                <Button label="Skip" variant="outline" onPress={() => { setCorners([]); setMode('place'); }} style={s.flex} />
              </View>
              <Text style={s.hint}>Mark every corner where a wall meets the floor, going around the room. Four corners is enough for a normal room. Measure to check: phone tracking is usually within a few centimetres per metre.</Text>
            </View>
          ) : (
            <View>
              {room && (
                <Text style={s.roomLine}>
                  Your room: {(room.widthCm / 100).toFixed(1)} × {(room.depthCm / 100).toFixed(1)} m · {room.areaM2.toFixed(1)} m²{room.rectangularity < 0.9 ? ' · irregular' : ''}
                </Text>
              )}
              <View style={s.tabs}>
                {(['suggested', 'all', 'rooms'] as const).map((t) => (
                  <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]} accessibilityRole="button" accessibilityState={{ selected: tab === t }}>
                    <Text style={[s.tabText, tab === t && { color: colors.accentInk }]}>{t === 'suggested' ? 'Suggested' : t === 'all' ? 'All' : 'Sample rooms'}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === 'rooms' ? (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {SAMPLE_ROOMS.map((r) => (
                      <Pressable key={r.id} onPress={() => setLayoutId(r.id)} style={[s.chip, r.id === layoutId && s.chipOn]}>
                        <Text style={[s.chipText, r.id === layoutId && { color: colors.accentInk }]}>{r.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {layoutDef && (
                    <Text style={[s.reason, fitsNow === false && { color: colors.danger }]}>
                      {room ? (fitsNow ? 'Fits your room. It will line up with your walls.' : 'Bigger than your scanned room.') : 'No scan yet: it will be placed where the dot is, so scan first for a wall-aligned fit.'}
                    </Text>
                  )}
                  <Button label={layout ? 'Place again' : 'Place this room design'} onPress={placeSample} disabled={!layoutDef || (!room && !hasSurface)} />
                  {layout && <Button label="Turn layout 90°" variant="outline" onPress={turnLayout} style={{ marginTop: 8 }} />}
                </View>
              ) : (
                <View>
                  {list.length === 0 && tab === 'suggested' ? <Text style={s.hint}>Nothing more fits this room. Try the All tab.</Text> : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      {list.map((f) => (
                        <Pressable key={f.id} onPress={() => setProductId(f.id)} style={[s.chip, f.id === productId && s.chipOn]}>
                          <Text style={[s.chipText, f.id === productId && { color: colors.accentInk }]}>{short(f.name)}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  {reason ? <Text style={s.reason}>{reason}</Text> : null}
                  <Button label={pendingDesign ? 'Place design' : `Place ${product ? short(product.name) : 'furniture'}`} onPress={place} disabled={!hasSurface || !product} />
                </View>
              )}

              {selected && (
                <View style={s.row}>
                  <Button label="Rotate left" variant="outline" onPress={() => onUpdate(selected.uid, { rotationY: selected.rotationY + 15 })} style={s.flex} />
                  <Button label="Rotate right" variant="outline" onPress={() => onUpdate(selected.uid, { rotationY: selected.rotationY - 15 })} style={s.flex} />
                  <Button label="Delete" variant="danger" onPress={remove} style={s.flex} />
                </View>
              )}
              <View style={s.row}>
                <Button label="Save design" variant="outline" onPress={save} style={s.flex} />
                <Button label="Take photo" variant="outline" onPress={photo} style={s.flex} />
                <Button label={room ? 'Re-scan' : 'Scan room'} variant="outline" onPress={() => { setCorners([]); setRoom(null); setLayout(null); setMode('scan'); }} style={s.flex} />
              </View>
              <Text style={s.hint}>Drag to move. Pinch to resize, twist to rotate. Grey boxes are to-scale stand-ins until a 3D model exists.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, alignItems: 'flex-start' },
  pill: { backgroundColor: 'rgba(20,33,31,0.75)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  pillText: { color: '#fff', fontWeight: '600' },
  status: { marginTop: 10, color: '#fff', backgroundColor: 'rgba(20,33,31,0.75)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '58%', backgroundColor: colors.surface, padding: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  roomLine: { color: colors.ink, fontWeight: '600', marginBottom: 8 },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, marginRight: 6 },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginRight: 8 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  reason: { color: colors.accent, fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', marginTop: 8 },
  flex: { flex: 1, marginHorizontal: 3 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
