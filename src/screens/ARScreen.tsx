import { t } from '../i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, PermissionsAndroid, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ARView from '../ar/ARView';
import type { ARSessionHandle } from '../ar/types';
import type { SceneProps } from '../ar/PlacementScene';
import { getFurniture, sizeLabel, usePlaceable } from '../data/furniture';
import { toRoomType } from '../data/rooms';
import { useRooms } from '../store/roomStore';
import { useSettings } from '../store/settingsStore';
import { useAuth } from '../store/authStore';
import { cloud } from '../services/api';
import { flushEvents, track } from '../services/events';
import { collidingUids } from '../utils/geometry';
import { fitsRoom, narrowUids } from '../utils/clearance';
import { alternatives, colourVariants, completeLook, pickAnchor } from '../recommend/helpers';
import { recommend } from '../recommend/engine';
import { CLOUD_ANCHORS } from '../config';
import { useLayoutHistory } from '../features/ar/useLayoutHistory';
import { usePlacement } from '../features/ar/usePlacement';
import { useDesignIO } from '../features/ar/useDesignIO';
import { useCapture } from '../features/ar/useCapture';
import { useFrameRate } from '../features/ar/useFrameRate';
import { useModelUris } from '../services/modelCache';
import { LOW_FPS, proxyUids as lodUids, shouldDropQuality } from '../utils/perf';
import { useScan } from '../features/ar/useScan';
import { useWall } from '../features/ar/useWall';
import { isWallOnly, type Vec3 } from '../features/ar/shared';
import { TopBar } from '../features/ar/components/TopBar';
import { StatusBanner } from '../features/ar/components/StatusBanner';
import { CoachingOverlay } from '../features/ar/components/CoachingOverlay';
import { PermissionGate } from '../features/ar/components/PermissionGate';
import { BottomSheet } from '../features/ar/components/BottomSheet';
import { SelectionActions } from '../features/ar/components/SelectionActions';
import { GestureHint } from '../components/GestureHint';
import type { RootStackParamList } from '../navigation/AppNavigator';

const TRACKING_NORMAL = 3;
const AUTO_PLACE_DELAY_MS = 1200; // lets the user aim after the floor is found, before the first piece drops

export default function ARScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'AR'>) {
  const FURNITURE = usePlaceable();
  const insets = useSafeAreaInsets();
  const session = useRef<ARSessionHandle>(null);
  const hit = useRef<Vec3 | null>(null);
  const planes = useRef(new Map<string, any>());
  const roomType = useRooms((s) => s.roomType);
  const quality = useSettings((s) => s.quality);
  const scanned = useSettings((s) => s.scanned);
  const token = useAuth((a) => a.token);

  const [camera, setCamera] = useState<'checking' | 'granted' | 'denied'>(Platform.OS === 'android' ? 'checking' : 'granted');
  const [productId, setProductId] = useState(route.params.productId ?? pickAnchor(roomType, FURNITURE)?.id ?? FURNITURE[0]?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [broken, setBroken] = useState<string[]>([]);
  const [hasSurface, setHasSurface] = useState(false);
  const [tracking, setTracking] = useState(0);
  const [everTracked, setEverTracked] = useState(false);

  const history = useLayoutHistory();
  const { items, commit, update } = history;
  const scan = useScan(route.params.mode === 'scan');
  const wall = useWall();
  const capture = useCapture(session);

  const product = productId ? getFurniture(productId) : undefined;
  const selected = items.find((i) => i.uid === selectedId) ?? null;
  const selectedProduct = selected ? getFurniture(selected.productId) : undefined;

  // Room numbers: this session's scan, else the last saved scan (so suggestions still fit the room).
  const room = scan.box
    ? { area: scan.box.areaM2, maxSpan: Math.hypot(scan.box.widthCm, scan.box.depthCm) / 100, longest: scan.box.widthCm }
    : scanned ? { area: scanned.areaM2, maxSpan: Math.hypot(scanned.widthCm, scanned.depthCm) / 100, longest: Math.max(scanned.widthCm, scanned.depthCm) } : null;
  const floorItems = useMemo(() => items.filter((i) => !isWallOnly(getFurniture(i.productId))), [items]);
  const usedM2 = floorItems.reduce((sum, i) => { const p = getFurniture(i.productId); return sum + (p ? (p.dimensionsCm.w * p.dimensionsCm.d) / 1e4 * i.scale * i.scale : 0); }, 0);
  const colliding = useMemo(() => [...collidingUids(floorItems, getFurniture)], [floorItems]);
  const narrow = useMemo(() => [...narrowUids(floorItems, getFurniture)], [floorItems]);

  const suggested = useMemo(
    () => recommend(FURNITURE, {
      roomType: toRoomType(roomType), areaM2: room?.area, longestWallCm: room?.longest, wallMarked: !!wall.wall,
      placed: items.flatMap((item) => { const p = getFurniture(item.productId); return p ? [{ product: p, item }] : []; }), maxResults: 8,
    }),
     
    [FURNITURE, roomType, room?.area, room?.longest, wall.wall, items],
  );
  const shownOnce = useRef(false);
  useEffect(() => { if (suggested.length && !shownOnce.current) { shownOnce.current = true; track('rec_shown', { n: suggested.length }); } }, [suggested]);

  const placement = usePlacement({ hit, items, commit, product, wall: wall.wall, selected, setSelectedId, isSuggested: (id) => suggested.some((r) => r.product.id === id) });
  const io = useDesignIO({ params: route.params, catalogue: FURNITURE, items, commit, session, hit, scan, planes, token, anchorProduct: selectedProduct ?? product, room,
    // After the 2nd saved design a guest is offered cloud backup (once; saving again does not re-ask).
    onSaved: (n) => { if (n === 2 && !token && cloud.enabled) Alert.alert(t('aR.backUpYourDesigns'), t('aR.signInToKeep'), [{ text: t('common.notNow'), style: 'cancel' }, { text: t('nav.signIn'), onPress: () => navigation.navigate('SignIn') }]); } });

  const place = async () => { if (!(await io.placePending())) placement.placePiece(); };

  // "View in my room" from a product page: drop that piece once the floor is found, so the user sees it right away.
  const [autoPlacing, setAutoPlacing] = useState(!!route.params.productId && !route.params.designId && !route.params.starter && route.params.mode !== 'scan');
  useEffect(() => {
    if (!hasSurface || !autoPlacing) return;
    const t = setTimeout(() => { setAutoPlacing(false); if (hit.current && !io.pending) placement.placePiece(); }, AUTO_PLACE_DELAY_MS);
    return () => clearTimeout(t);
  }, [hasSurface, autoPlacing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android needs an explicit runtime camera permission; iOS prompts when the AR session starts.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).then((r) => setCamera(r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied'));
  }, []);
  useEffect(() => { track('ar_opened', { from: route.params.designId ? 'design' : route.params.productId ? 'product' : 'direct' }); return () => { hit.current = null; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onHit = useCallback((pos: Vec3 | null) => { hit.current = pos; setHasSurface(!!pos); }, []);
  const onTracking = useCallback((st: number) => { setTracking(st); if (st === TRACKING_NORMAL) setEverTracked(true); }, []);
  const onAnchor = useCallback((a: any) => { if (a?.anchorId) planes.current.set(a.anchorId, a); }, []);
  const onModelError = useCallback((uid: string) => setBroken((b) => (b.includes(uid) ? b : [...b, uid])), []);
  const high = quality === 'high';
  // Models are cached on the phone (and the selected one is fetched before it is placed); past 15 real models the rest draw as shapes.
  const modelUris = useModelUris([...items.map((i) => getFurniture(i.productId)), product]);
  const proxyUids = useMemo(() => lodUids(items, getFurniture), [items]);
  const setQuality = useSettings((s) => s.setQuality);
  const [dropped, setDropped] = useState(false);
  const hintSeen = useSettings((s) => s.hintsSeen.ar);
  const markHint = useSettings((s) => s.markHint);
  const [hint, setHint] = useState(false);
  // The first time a piece lands, show how to move, turn and resize it with the fingers.
  useEffect(() => { if (!hintSeen && items.length > 0) { const id = setTimeout(() => setHint(true), 900); return () => clearTimeout(id); } }, [hintSeen, items.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrameRate(high && items.length >= 10, LOW_FPS, (fps) => { if (shouldDropQuality(quality, fps, items.length)) { setQuality('standard', false); setDropped(true); } });
  const sceneProps = useMemo<Omit<SceneProps, 'bridge'>>(
    () => ({ items, selectedId, colliding, corners: [...scan.corners, ...wall.points], outline: scan.outline, wall: wall.wall, modelUris, proxyUids, shadows: high, onHit, onTracking, onAnchor, onSelect: setSelectedId, onUpdate: update, onModelError }),
    [items, selectedId, colliding, scan.corners, scan.outline, wall.points, wall.wall, modelUris, proxyUids, high, onHit, onTracking, onAnchor, update, onModelError]);

  const lost = everTracked && tracking !== TRACKING_NORMAL;
  const status = dropped ? t('ar.qualityDropped') : scan.scanning ? t('ar.statusScan', { n: scan.corners.length })
    : wall.active ? t('ar.statusWall', { n: wall.points.length })
    : colliding.length > 0 ? t('ar.statusOverlap')
    : narrow.length > 0 ? t('ar.statusNarrow')
    : lost ? t('ar.statusLost')
    : autoPlacing && hasSurface ? t('ar.statusPlacing', { name: product?.name ?? t('ar.yourPiece') })
    : hasSurface ? t('ar.statusFound') : t('ar.statusScanFloor');
  const lastAnnounced = useRef('');
  useEffect(() => { if (status !== lastAnnounced.current) { lastAnnounced.current = status; AccessibilityInfo.announceForAccessibility(status); } }, [status]);

  if (camera !== 'granted') return <PermissionGate state={camera} top={insets.top + 40} onBack={() => navigation.goBack()} />;

  const roomLine = scan.box ? t('ar.roomLine', { w: (scan.box.widthCm / 100).toFixed(1), d: (scan.box.depthCm / 100).toFixed(1), area: scan.box.areaM2.toFixed(1), free: Math.max(0, scan.box.areaM2 - usedM2).toFixed(1) }) : undefined;
  const selectedLine = selectedProduct && selected
    ? `${selectedProduct.name} · ${sizeLabel(selectedProduct)}${!selectedProduct.model3D ? ` · ${t('ar.simplifiedShape')}` : ''}${selected.scale !== 1 ? ` · ${t('ar.sizePercent', { pct: Math.round(selected.scale * 100) })}` : ''}` : undefined;
  const fit = room ? { area: room.area, maxSpan: room.maxSpan } : null;
  const pairs = selectedProduct ? completeLook(selectedProduct, FURNITURE, items.map((i) => i.productId)).filter((p) => !fit || fitsRoom(p, fit, usedM2)).slice(0, 4) : [];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ARView ref={session} sceneProps={sceneProps} high={high} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, paddingTop: insets.top + 8, alignItems: 'flex-start' }}>
        <TopBar onHelp={() => setHint(true)}
          onClose={() => { flushEvents(); navigation.goBack(); }} recording={capture.recording} onToggleVideo={capture.toggleVideo}
          canUndo={history.canUndo} canRedo={history.canRedo}
          onUndo={() => history.undo() && setSelectedId(null)} onRedo={() => history.redo() && setSelectedId(null)} />
        <StatusBanner status={status} bad={colliding.length > 0 || narrow.length > 0 || lost} brokenCount={broken.length}
          onRemoveBroken={() => { commit(items.filter((i) => !broken.includes(i.uid))); setBroken([]); }} roomLine={roomLine} selectedLine={selectedLine} />
      </View>
      {(!hasSurface || lost) && <CoachingOverlay lost={lost} />}
      <GestureHint visible={hint} steps={['drag', 'twist', 'resize']} onClose={() => { setHint(false); markHint('ar'); }} />
      <BottomSheet
        bottomInset={insets.bottom} products={FURNITURE} suggested={suggested} productId={productId} onPick={setProductId}
        scan={scan} wall={wall} hasSurface={hasSurface} onAddCorner={() => scan.mark(hit.current)} onAddWallPoint={() => wall.addPoint(hit.current)}
        placeLabel={io.pending ? io.placeLabel : t('ar.placeProduct', { name: product?.name ?? t('ar.furniture') })} onPlace={place} pending={io.pending} onTurn={io.turn} onRoom={io.loadRoom}
        tools={{ save: io.save, photo: capture.photo, thinking: io.thinking, aiLayout: cloud.enabled && token ? io.aiLayout : undefined, pin: CLOUD_ANCHORS ? io.pin : undefined }}
        selection={selected && selectedProduct ? (
          <SelectionActions selected={selectedProduct} variants={colourVariants(selectedProduct, FURNITURE).slice(0, 4)} pairs={pairs} swaps={alternatives(selectedProduct, FURNITURE).slice(0, 3)}
            onSwap={placement.swap} onPick={setProductId} onCopy={placement.duplicate} onDelete={placement.remove} />
        ) : undefined} />
    </View>
  );
}
