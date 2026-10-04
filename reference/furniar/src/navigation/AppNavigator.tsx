import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import RoomsScreen from '../screens/RoomsScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import SavedScreen from '../screens/SavedScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ProductScreen from '../screens/ProductScreen';
import ARScreen from '../screens/ARScreen';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';

export type RootStackParamList = {
  Welcome: undefined;
  Tabs: undefined;
  Product: { id: string };
  RoomDetail: { id: string };
  AR: { productId?: string; designId?: string; roomId?: string; mode?: 'scan' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.accent, headerShadowVisible: false }}>
      <Tab.Screen name="Explore" component={HomeScreen} />
      <Tab.Screen name="Rooms" component={RoomsScreen} options={{ title: 'Sample rooms' }} />
      <Tab.Screen name="Designs" component={SavedScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  // Wait for saved settings to load so returning users don't see the front page flash.
  const [ready, setReady] = useState(useSettings.persist.hasHydrated());
  useEffect(() => useSettings.persist.onFinishHydration(() => setReady(true)), []);
  const onboarded = useSettings((s) => s.onboarded);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Stack.Navigator initialRouteName={onboarded ? 'Tabs' : 'Welcome'}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: '' }} />
      <Stack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: 'Sample room' }} />
      <Stack.Screen name="AR" component={ARScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
