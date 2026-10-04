import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { designPlan, planSvg, type Plan } from '../plan/planSvg.mjs';
import type { Product, SampleRoom, SavedDesign } from '../types/furniture';
import { t } from '../i18n';

const toPlan = (room: SampleRoom, find: (id: string) => Product | undefined): Plan => ({
  roomCm: room.roomCm,
  pieces: room.pieces.flatMap((pc) => {
    const p = find(pc.productId);
    return p ? [{ x: pc.x, z: pc.z, rot: pc.rot, w: p.dimensionsCm.w, d: p.dimensionsCm.d, fill: p.colors[0]?.hex, label: p.role.replace('-', ' ') }] : [];
  }),
});

/**
 * Top-down plan drawn to scale from the real product dimensions. The drawing itself is src/plan/planSvg.mjs, shared with the
 * server's share page, so the app and the web page always look the same. Give it a curated `room` or a saved `design`.
 */
export function RoomPlan({ room, design, find, width, highlight, scanCm }: {
  room?: SampleRoom; design?: Pick<SavedDesign, 'items'>; find: (id: string) => Product | undefined; width: number; highlight?: number; scanCm?: { w: number; d: number };
}) {
  const xml = useMemo(() => {
    const plan = room ? toPlan(room, find) : designPlan(design?.items ?? [], find, scanCm);
    const title = room ? t('roomPlan.room', { title: room.title, w: room.roomCm.w, d: room.roomCm.d }) : t('roomPlan.design', { w: plan.roomCm.w, d: plan.roomCm.d });
    return { svg: planSvg({ ...plan, width, highlight, title }), h: plan.roomCm.d * ((width - 22) / plan.roomCm.w) + 22, title };
  }, [room, design, find, width, highlight, scanCm]);
  return <SvgXml xml={xml.svg} width={width} height={xml.h} accessibilityLabel={xml.title} />;
}
