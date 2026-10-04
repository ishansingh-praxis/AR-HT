import { t } from '../i18n';
import React from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AR'>;

// Viro is a native module: it is missing in Expo Go. Load the AR screen lazily so the rest of the app still runs.
// Don't even import it in Expo Go: Viro logs errors at import time when its native modules are missing.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let Real: React.ComponentType<Props> | null = null;
if (!inExpoGo) {
  try {
    Real = require('./ARScreen').default;
  } catch {
    Real = null;
  }
}

export default function ARScreenGate(props: Props) {
  if (Real) return <Real {...props} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
      <Text accessibilityLabel={t('aRScreenGate.arUnavailable')} style={{ textAlign: 'center', color: colors.ink }}>
        {t('aRScreenGate.arNeedsADevelopment')}
      </Text>
    </View>
  );
}
