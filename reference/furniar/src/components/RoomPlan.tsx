import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Product, SampleRoom } from '../types/furniture';
import { colors } from '../theme';

/** Top-down plan of a sample room, drawn to scale from the real product dimensions. */
export function RoomPlan({ room, find, width }: { room: SampleRoom; find: (id: string) => Product | undefined; width: number }) {
  const k = width / room.roomCm.w;
  const height = room.roomCm.d * k;
  return (
    <View style={[s.plan, { width, height }]} accessibilityLabel={`Plan of ${room.title}, ${room.roomCm.w} by ${room.roomCm.d} centimetres`}>
      {room.pieces.map((pc, i) => {
        const p = find(pc.productId);
        if (!p) return null;
        const sideways = Math.abs(pc.rot) === 90;
        const w = (sideways ? p.dimensionsCm.d : p.dimensionsCm.w) * k, d = (sideways ? p.dimensionsCm.w : p.dimensionsCm.d) * k;
        const hex = p.colors[0]?.hex ?? '#B8C4C0';
        return (
          <View key={i} style={[s.piece, { left: pc.x * k - w / 2, top: pc.z * k - d / 2, width: w, height: d, backgroundColor: hex + 'CC', borderColor: hex }]}>
            {/* front edge marker so you can see which way each piece faces */}
            <View style={[s.front, pc.rot === 0 ? { bottom: 0, left: 0, right: 0, height: 3 } : pc.rot === 180 ? { top: 0, left: 0, right: 0, height: 3 } : pc.rot === 90 ? { right: 0, top: 0, bottom: 0, width: 3 } : { left: 0, top: 0, bottom: 0, width: 3 }]} />
            {w > 34 && d > 18 ? <Text style={s.label} numberOfLines={1}>{p.role.replace('-', ' ')}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  plan: { backgroundColor: '#EEF2F0', borderWidth: 2, borderColor: colors.ink, borderRadius: 4, overflow: 'hidden' },
  piece: { position: 'absolute', borderWidth: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  front: { position: 'absolute', backgroundColor: colors.ink, opacity: 0.55 },
  label: { fontSize: 9, color: colors.ink },
});
