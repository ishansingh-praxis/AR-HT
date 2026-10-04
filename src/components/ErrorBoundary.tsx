import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { reportError } from '../services/monitoring';
import { colors } from '../theme';
import { t } from '../i18n';

interface Props { where: string; children: React.ReactNode }
interface State { failed: boolean }

/** Catches a crash in one screen and offers "Try again" instead of closing the whole app. The error is reported (scrubbed) with `where`. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: unknown) { reportError(error, this.props.where); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={s.box} accessibilityRole="alert">
        <Text style={s.title}>{t('errorBoundary.somethingWentWrong')}</Text>
        <Text style={s.text}>{t('errorBoundary.thisScreenHitA')}</Text>
        <Button label={t('errorBoundary.tryAgain')} onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

/** Wraps a screen component so a crash in it stays inside it. */
export function withBoundary<P extends object>(Screen: React.ComponentType<P>, where: string): React.ComponentType<P> {
  const Wrapped = (props: P) => <ErrorBoundary where={where}><Screen {...props} /></ErrorBoundary>;
  Wrapped.displayName = `Boundary(${where})`;
  return Wrapped;
}

const s = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  text: { color: colors.muted, textAlign: 'center', marginBottom: 18, lineHeight: 21 },
});
