import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { colors } from '../theme';
import { t } from '../i18n';

export type HintStep = 'drag' | 'twist' | 'pinch' | 'resize' | 'slide';
const captionKey = (s: HintStep) => `hint.${s === 'resize' ? 'pinchResize' : s}`; // AR: pinching resizes the piece (80 to 125 %); on the plan it zooms
const STEP_MS = 3400;
const HAND = '👆'; // a pointing hand: it shows where to put your finger

/**
 * "How to" demo: a small piece and an animated hand that drags it, twists it, pinches it or slides the view, one gesture after another.
 * Used by the AR screen and the room plan, so both teach the same gestures. With "reduce motion" on, the hand stays still.
 */
export function GestureHint({ visible, steps, onClose }: { visible: boolean; steps: HintStep[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The demo only exists while the modal is open, so it starts from the first gesture every time */}
      {visible ? <Demo steps={steps} onClose={onClose} /> : <View />}
    </Modal>
  );
}

function Demo({ steps, onClose }: { steps: HintStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [still, setStill] = useState(false);
  const [t01] = useState(() => new Animated.Value(0));

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  useEffect(() => {
    if (steps.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), STEP_MS);
    return () => clearInterval(id);
  }, [steps.length]);
  useEffect(() => {
    if (still) { t01.setValue(0.5); return; }
    t01.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t01, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(t01, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(250),
    ]));
    loop.start();
    return () => loop.stop();
  }, [i, still, t01]);

  const step = steps[Math.min(i, steps.length - 1)];
  const x = (a: number, b: number) => t01.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const deg = (a: number, b: number) => t01.interpolate({ inputRange: [0, 1], outputRange: [`${a}deg`, `${b}deg`] });

  const piece = (extra: object = {}) => <Animated.View style={[s.piece, extra]}><View style={s.front} /></Animated.View>;
  const hand = (style: object) => <Animated.Text style={[s.hand, style]} accessibilityElementsHidden importantForAccessibility="no">{HAND}</Animated.Text>;

  return (
      <View style={s.backdrop}>
        <View style={s.card} accessibilityViewIsModal>
          <Text style={s.title} accessibilityRole="header">{t('hint.title')}</Text>
          <View style={s.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={s.grid} />
            {step === 'drag' && <>{piece({ transform: [{ translateX: x(-60, 60) }] })}{hand({ transform: [{ translateX: x(-60, 60) }, { translateY: 22 }] })}</>}
            {step === 'twist' && (
              <Animated.View style={[s.group, { transform: [{ rotate: deg(-25, 40) }] }]}>
                {piece()}
                {hand({ left: -52, top: 6 })}{hand({ right: -52, top: 6 })}
              </Animated.View>
            )}
            {(step === 'pinch' || step === 'resize') && <>
              {piece({ transform: [{ scale: x(0.8, 1.3) }] })}
              {hand({ transform: [{ translateX: x(-18, -62) }, { translateY: 26 }] })}{hand({ transform: [{ translateX: x(18, 62) }, { translateY: 26 }] })}
            </>}
            {step === 'slide' && <>
              <Animated.View style={[s.group, { transform: [{ translateX: x(-50, 50) }, { translateY: x(-14, 14) }] }]}>{piece()}</Animated.View>
              {hand({ transform: [{ translateX: x(-50, 50) }, { translateY: x(8, 36) }] })}
            </>}
          </View>
          <Text style={s.caption} accessibilityLiveRegion="polite">{t(captionKey(step))}</Text>
          <View style={s.dots}>{steps.map((st, n) => <Pressable key={st} accessibilityRole="button" accessibilityLabel={t(captionKey(st))} onPress={() => setI(n)} style={[s.dot, n === i && s.dotOn]} hitSlop={10} />)}</View>
          <Button label={t('hint.gotIt')} onPress={onClose} />
        </View>
      </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 18, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  stage: { height: 170, borderRadius: 14, backgroundColor: colors.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5, borderWidth: 1, borderColor: colors.line, margin: 10, borderRadius: 8 },
  group: { width: 130, height: 90, alignItems: 'center', justifyContent: 'center' },
  piece: { width: 96, height: 52, borderRadius: 8, backgroundColor: colors.accent, justifyContent: 'flex-end' },
  front: { height: 5, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)' },
  hand: { position: 'absolute', fontSize: 38 },
  caption: { fontSize: 16, color: colors.ink, textAlign: 'center', marginTop: 12, minHeight: 44, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line, marginHorizontal: 5 },
  dotOn: { backgroundColor: colors.accent },
});
