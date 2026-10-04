import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getFurniture } from '../../data/furniture';
import { describePiece, type PlanPiece, type RoomSize, type Wall } from '../../plan/editor';
import { colors } from '../../theme';
import { t } from '../../i18n';

const MOVES: { dir: Wall; label: string }[] = [{ dir: 'north', label: t('plan.moveNorth') }, { dir: 'south', label: t('plan.moveSouth') }, { dir: 'west', label: t('plan.moveWest') }, { dir: 'east', label: t('plan.moveEast') }];

/**
 * Every piece as an accessible row: "Sofa, 202 by 89 cm, 45 cm from the north wall". Screen reader users move and turn pieces with the
 * custom actions (swipe up/down on the row); everyone can tap a row to select it.
 */
export function PieceList({ pieces, room, selectedId, onSelect, onMove, onRotate, onDelete }: {
  pieces: PlanPiece[]; room: RoomSize; selectedId: string | null; onSelect: (uid: string) => void;
  onMove: (uid: string, dir: Wall) => void; onRotate: (uid: string, by: number) => void; onDelete: (uid: string) => void;
}) {
  if (!pieces.length) return <Text style={s.empty}>{t('pieceList.noPiecesYetAdd')}</Text>;
  return (
    <View>
      {pieces.map((p) => {
        const pr = getFurniture(p.productId);
        if (!pr) return null;
        const on = p.uid === selectedId;
        return (
          <Pressable
            key={p.uid} accessible accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onSelect(p.uid)}
            accessibilityLabel={describePiece(pr.name, p, pr.dimensionsCm, room)}
            accessibilityActions={[...MOVES.map((m) => ({ name: m.dir, label: m.label })), { name: 'rotateRight', label: t('plan.turnRight') }, { name: 'rotateLeft', label: t('plan.turnLeft') }, { name: 'delete', label: t('plan.removePiece') }]}
            onAccessibilityAction={(e) => {
              const n = e.nativeEvent.actionName;
              if (n === 'rotateRight') onRotate(p.uid, 90); else if (n === 'rotateLeft') onRotate(p.uid, -90); else if (n === 'delete') onDelete(p.uid); else onMove(p.uid, n as Wall);
            }}
            style={[s.row, on && s.on]}
          >
            <Text style={s.name} numberOfLines={1}>{pr.name}</Text>
            <Text style={s.meta}>{Math.round(pr.dimensionsCm.w)} × {Math.round(pr.dimensionsCm.d)} cm · {Math.round(p.rot)}°</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { color: colors.muted, paddingVertical: 8 },
  row: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: 6 },
  on: { borderColor: colors.accent, borderWidth: 2 },
  name: { color: colors.ink, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
