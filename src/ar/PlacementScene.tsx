import React, { useEffect, useRef, useState } from 'react';
import {
  Viro3DObject, ViroAmbientLight, ViroDirectionalLight, ViroARScene, ViroMaterials, ViroPolyline, ViroQuad,
} from './viro';
import { getFurniture } from '../data/furniture';
import { hangOnWall, type Wall } from '../utils/wall';
import { PROXY_ASSETS } from '../data/proxyAssets';
import type { PlacedItem } from '../types/furniture';
import { shadowFrame } from '../utils/shadow';
import type { Vec3 } from './types';

const SNAP_M = 0.05; // drag snaps to a 5 cm grid

ViroMaterials.createMaterials({
  reticle: { diffuseColor: '#FFFFFFCC', lightingModel: 'Constant' },
  ring: { diffuseColor: '#2F6F5ECC', lightingModel: 'Constant' },
  corner: { diffuseColor: '#F5C518EE', lightingModel: 'Constant' },
  ringBad: { diffuseColor: '#D8402FCC', lightingModel: 'Constant' },
});

export const isWallOnly = (p?: { ar?: { placements: string[] } }) => !!p?.ar?.placements.includes('wall') && !p.ar.placements.includes('floor');
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number) => Math.round(v / SNAP_M) * SNAP_M;

export interface SceneProps {
  items: PlacedItem[];
  selectedId: string | null;
  colliding: string[];
  corners: Vec3[];
  /** Closed floor outline of the scanned room (empty until 2+ corners). */
  outline: Vec3[];
  wall: Wall | null;
  /** productId -> cached local file of its model (falls back to streaming the URL). */
  modelUris: Record<string, string>;
  /** uids drawn as their simplified shape because too many real models are in the scene. */
  proxyUids: string[];
  shadows: boolean;
  onHit: (pos: Vec3 | null) => void;
  onTracking: (state: number) => void;
  onAnchor: (a: any) => void;
  bridge: { current: any };
  onSelect: (uid: string) => void;
  onUpdate: (uid: string, patch: Partial<PlacedItem>) => void;
  onModelError: (uid: string) => void;
}

export function PlacementScene(props: any) {
  const { items, selectedId, colliding, corners, outline, wall, modelUris, proxyUids, shadows, onHit, onTracking, onAnchor, bridge, onSelect, onUpdate, onModelError } = props.sceneNavigator.viroAppProps as SceneProps;
  // exposes hostCloudAnchor / resolveCloudAnchor to the screen
  useEffect(() => { bridge.current = props.sceneNavigator; });
  const [reticle, setReticle] = useState<Vec3 | null>(null);
  const [light, setLight] = useState({ intensity: 900, color: '#FFFFFF' });
  const last = useRef<Vec3 | null>(null);
  const base = useRef<Record<string, { scale: number; rot: number }>>({});

  // Fires every frame; only update state when the hit moved > 1 cm so the scene doesn't re-render at camera rate.
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

  return (
    <ViroARScene
      onCameraARHitTest={onCameraARHitTest}
      onTrackingUpdated={(state: number) => onTracking(state)}
      onAnchorFound={onAnchor}
      onAnchorUpdated={onAnchor}
      onAmbientLightUpdate={(u: { intensity: number; color: string }) =>
        setLight((cur) =>
          u.intensity >= 200 && u.intensity <= 3000 && Math.abs(u.intensity - cur.intensity) / cur.intensity > 0.1
            ? { intensity: u.intensity, color: u.color || cur.color } : cur)
      }
    >
      <ViroAmbientLight color={light.color} intensity={light.intensity} />
      {shadows && items.length > 0 && (() => {
        // Frame the shadow camera around ALL floor pieces, not just the first one.
        const frame = shadowFrame(items.filter((i) => !isWallOnly(getFurniture(i.productId))).map((i) => i.position));
        return (
          <ViroDirectionalLight
            color="#FFFFFF" intensity={600} direction={[0.3, -1, -0.4]} castsShadow shadowOpacity={0.5} shadowMapSize={1024}
            shadowOrthographicSize={frame.size} shadowNearZ={0.1} shadowFarZ={frame.position[1] + 3}
            shadowOrthographicPosition={[frame.position[0] - 0.9, frame.position[1], frame.position[2] + 1.2]}
          />
        );
      })()}
      {reticle && <ViroQuad position={reticle} rotation={[-90, 0, 0]} width={0.22} height={0.22} materials={['reticle']} />}
      {corners.map((c, i) => (
        <ViroQuad key={'c' + i} position={[c[0], c[1] + 0.004, c[2]]} rotation={[-90, 0, 0]} width={0.14} height={0.14} materials={['corner']} />
      ))}
      {outline.length >= 2 && <ViroPolyline points={outline.map((c) => [c[0], c[1] + 0.006, c[2]])} thickness={0.01} materials={['corner']} />}
      {items.map((it) => {
        const product = getFurniture(it.productId);
        if (!product || (!product.model3D && !product.proxy)) return null;
        const real = !!product.model3D && !(proxyUids.includes(it.uid) && product.proxy);
        // Photo-real model: uniform scale. Simplified shape: a 1 m cube stretched to the real W x H x D.
        const sc: Vec3 = real ? [it.scale, it.scale, it.scale]
          : [(product.dimensionsCm.w / 100) * it.scale, (product.dimensionsCm.h / 100) * it.scale, (product.dimensionsCm.d / 100) * it.scale];
        const source = real ? { uri: modelUris[product.id] ?? product.model3D!.url } : PROXY_ASSETS[`${product.proxy!.template}-${product.proxy!.color}`];
        const wallOnly = isWallOnly(product);
        const bad = colliding.includes(it.uid);
        // Selection ring sized to the real footprint.
        const rw = (product.dimensionsCm.w / 100) * it.scale + 0.1;
        const rd = (product.dimensionsCm.d / 100) * it.scale + 0.1;
        return (
          <React.Fragment key={it.uid}>
            {shadows && !wallOnly && (
              <ViroQuad position={[it.position[0], it.position[1] - 0.001, it.position[2]]} rotation={[-90, 0, 0]} width={3 * it.scale} height={3 * it.scale} arShadowReceiver />
            )}
            {!wallOnly && (selectedId === it.uid || bad) && (
              <ViroQuad position={[it.position[0], it.position[1] + 0.003, it.position[2]]} rotation={[-90, it.rotationY, 0]} width={rw} height={rd} materials={[bad ? 'ringBad' : 'ring']} />
            )}
            <Viro3DObject
              source={source as any} type="GLB"
              position={it.position} rotation={[0, it.rotationY, 0]} scale={sc}
              dragType="FixedToWorld"
              onClickState={(state: number) => state === 3 && onSelect(it.uid)}
              onDrag={(pos: number[]) => {
                // Wall pieces slide along the marked wall (and up/down); floor pieces slide on the floor.
                if (wallOnly && wall) {
                  const sz = { w: product.dimensionsCm.w * it.scale, h: product.dimensionsCm.h * it.scale, d: product.dimensionsCm.d };
                  onUpdate(it.uid, { position: hangOnWall(wall, pos as Vec3, sz, pos[1] + sz.h / 200).position });
                } else if (!wallOnly) onUpdate(it.uid, { position: [snap(pos[0]), it.position[1], snap(pos[2])] });
              }}
              onPinch={(state: number, factor: number) => {
                if (state === 1) delete base.current[it.uid];
                // Resize is limited so "true scale" stays honest: 80%-125% of the listed size.
                onUpdate(it.uid, { scale: clamp(grab(it).scale * factor, 0.8, 1.25) });
              }}
              onRotate={(state: number, factor: number) => {
                if (state === 1) delete base.current[it.uid];
                onUpdate(it.uid, { rotationY: grab(it).rot - factor });
              }}
              onError={() => { console.warn('Failed to load model', product.model3D?.url ?? `${product.proxy?.template}-${product.proxy?.color}`); onModelError(it.uid); }}
            />
          </React.Fragment>
        );
      })}
    </ViroARScene>
  );
}
