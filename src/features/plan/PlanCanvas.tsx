import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { planSvg } from '../../plan/planSvg.mjs';
import { clampScale, halfExtent, screenToPlan, type PlanPiece, type RoomSize } from '../../plan/editor';
import { getFurniture } from '../../data/furniture';
import { colors } from '../../theme';
import { t } from '../../i18n';

const PAD = 22; // same padding as planSvg

interface Props {
  width: number;
  room: RoomSize;
  pieces: PlanPiece[];
  selectedId: string | null;
  flagged: string[];
  onSelect: (uid: string | null) => void;
  onDragStart: (uid: string) => void;
  onDragTo: (uid: string, xCm: number, zCm: number) => void;
  onDragEnd: () => void;
  /** Two-finger twist on the selected piece (degrees, turning left = positive like the rest of the app). */
  onTwistStart: (uid: string) => void;
  onTwistTo: (uid: string, rotDeg: number) => void;
  onTwistEnd: () => void;
}

/**
 * The to-scale plan. One finger drags a piece (5 cm steps); two fingers pan and pinch-zoom the canvas.
 * Gestures sit on a fixed outer view, so the maths is always: plan = (screen - pan) / zoom (see screenToPlan).
 */
export function PlanCanvas({ width, room, pieces, selectedId, flagged, onSelect, onDragStart, onDragTo, onDragEnd, onTwistStart, onTwistTo, onTwistEnd }: Props) {
  const pxPerCm = (width - PAD) / room.w;
  const height = room.d * pxPerCm + PAD;
  const scale = useSharedValue(1), tx = useSharedValue(0), ty = useSharedValue(0);
  const baseScale = useSharedValue(1), baseTx = useSharedValue(0), baseTy = useSharedValue(0);
  const dragId = useSharedValue('');
  const twistBase = useSharedValue(0);
  const slideBase = useSharedValue({ x: 0, y: 0 });
  const selectedRot = pieces.find((p) => p.uid === selectedId)?.rot ?? 0;
  const grab = useSharedValue({ dx: 0, dz: 0 });

  const svg = useMemo(() => planSvg({
    roomCm: room, width, title: t('plan.canvasTitle', { w: Math.round(room.w), d: Math.round(room.d) }),
    highlight: pieces.findIndex((p) => p.uid === selectedId),
    flagged: pieces.flatMap((p, i) => (flagged.includes(p.uid) ? [i] : [])),
    pieces: pieces.flatMap((p) => {
      const pr = getFurniture(p.productId);
      return pr ? [{ x: p.x, z: p.z, rot: p.rot, w: pr.dimensionsCm.w, d: pr.dimensionsCm.d, fill: pr.colors[0]?.hex, label: pr.role.replace('-', ' ') }] : [];
    }),
  }), [room, width, pieces, selectedId, flagged]);

  /** Which piece is under a screen point? Topmost (last) wins. Runs on the JS thread. */
  const hit = (sx: number, sy: number, s: number, x: number, y: number) => {
    const at = screenToPlan(sx, sy, { scale: s, tx: x, ty: y }, pxPerCm, PAD);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i], pr = getFurniture(p.productId);
      if (!pr) continue;
      const a = (p.rot * Math.PI) / 180, dx = at.x - p.x, dz = at.z - p.z;
      const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(lx) <= Math.max(pr.dimensionsCm.w / 2, 20) && Math.abs(lz) <= Math.max(pr.dimensionsCm.d / 2, 20)) return { p, at, dx, dz, half: halfExtent(p, pr.dimensionsCm) };
    }
    return null;
  };
  const begin = (sx: number, sy: number, s: number, x: number, y: number) => {
    const h = hit(sx, sy, s, x, y);
    if (!h) { onSelect(null); dragId.value = ''; return; }
    dragId.value = h.p.uid; grab.value = { dx: h.dx, dz: h.dz };
    onDragStart(h.p.uid);
  };
  const dragMove = (uid: string, sx: number, sy: number, s: number, x: number, y: number, gx: number, gz: number) => {
    const at = screenToPlan(sx, sy, { scale: s, tx: x, ty: y }, pxPerCm, PAD);
    onDragTo(uid, at.x - gx, at.z - gz);
  };

  // One finger: on a piece it drags the piece (5 cm steps); on empty floor it slides the whole view.
  const drag = Gesture.Pan().maxPointers(1).minDistance(4)
    .onBegin((e) => { slideBase.value = { x: tx.value, y: ty.value }; runOnJS(begin)(e.x, e.y, scale.value, tx.value, ty.value); })
    .onUpdate((e) => {
      if (dragId.value) runOnJS(dragMove)(dragId.value, e.x, e.y, scale.value, tx.value, ty.value, grab.value.dx, grab.value.dz);
      else { tx.value = slideBase.value.x + e.translationX; ty.value = slideBase.value.y + e.translationY; }
    })
    .onFinalize(() => { if (dragId.value) { runOnJS(onDragEnd)(); dragId.value = ''; } });
  // Two fingers twisting: turns the selected piece.
  const twist = Gesture.Rotation()
    .onStart(() => { twistBase.value = selectedRot; if (selectedId) runOnJS(onTwistStart)(selectedId); })
    .onUpdate((e) => { if (selectedId) runOnJS(onTwistTo)(selectedId, twistBase.value - (e.rotation * 180) / Math.PI); })
    .onFinalize(() => { if (selectedId) runOnJS(onTwistEnd)(); });
  const pan = Gesture.Pan().minPointers(2)
    .onStart(() => { baseTx.value = tx.value; baseTy.value = ty.value; })
    .onUpdate((e) => { tx.value = baseTx.value + e.translationX; ty.value = baseTy.value + e.translationY; });
  const pinch = Gesture.Pinch()
    .onStart(() => { baseScale.value = scale.value; })
    .onUpdate((e) => { scale.value = clampScale(baseScale.value * e.scale); });
  const gesture = Gesture.Simultaneous(Gesture.Exclusive(pan, drag), pinch, twist);

  const style = useAnimatedStyle(() => ({ transformOrigin: 'top left', transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  return (
    <View style={[s.frame, { width, height: Math.min(height, 520) }]} accessibilityLabel={t('plan.canvasLabel', { w: Math.round(room.w), d: Math.round(room.d) })}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[{ width, height }, style]} pointerEvents="none"><SvgXml xml={svg} width={width} height={height} /></Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: colors.surface, borderRadius: 12 } });
