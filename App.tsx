import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/AppNavigator';
import { linking } from './src/navigation/linking';
import { useCatalogue } from './src/store/catalogueStore';
import { flushEvents, track } from './src/services/events';
import { startSyncTriggers } from './src/services/sync';
import { initMonitoring, wrapApp } from './src/services/monitoring';
import { checkARSupport } from './src/ar/support';
import { useSettings } from './src/store/settingsStore';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { pickQuality } from './src/utils/perf';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

initMonitoring();

function App() {
  useEffect(() => { useCatalogue.getState().hydrate().finally(() => useCatalogue.getState().refresh()); }, []);
  useEffect(() => startSyncTriggers(), []);
  useEffect(() => { checkARSupport().then((ok) => useSettings.getState().setArSupported(ok)); }, []);
  // First run: pick Standard or High from the phone's class (the user can change it in Settings).
  useEffect(() => {
    const apply = () => {
      const s = useSettings.getState();
      if (s.qualityChosen) return;
      s.setQuality(pickQuality({ os: Platform.OS, ramBytes: Device.totalMemory, apiLevel: Device.platformApiLevel, modelId: Device.modelId }), false);
      s.setQualityAuto(true);
    };
    if (useSettings.persist.hasHydrated()) apply(); else return useSettings.persist.onFinishHydration(apply);
  }, []);
  useEffect(() => {
    track('app_opened');
    const sub = AppState.addEventListener('change', (st) => { if (st === 'background') flushEvents(); });
    return () => sub.remove();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapApp(App);
