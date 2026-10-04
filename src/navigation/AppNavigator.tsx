import { t } from '../i18n';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RawWelcomeScreen from '../screens/WelcomeScreen';
import RawLibraryScreen from '../screens/LibraryScreen';
import RawItemScreen from '../screens/ItemScreen';
import RawDesignsScreen from '../screens/DesignsScreen';
import RawSettingsScreen from '../screens/SettingsScreen';
import RawARScreen from '../screens/ARScreenGate';
import RawRoomsScreen from '../screens/RoomsScreen';
import RawRoomDetailScreen from '../screens/RoomDetailScreen';
import RawPlanScreen from '../screens/PlanScreen';
import RawRoomStudioScreen from '../screens/RoomStudioScreen';
import { Ionicons } from '@expo/vector-icons';
import RawSharedDesignScreen from '../screens/SharedDesignScreen';
import RawSignInScreen from '../screens/auth/SignInScreen';
import RawSignUpScreen from '../screens/auth/SignUpScreen';
import RawVerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import RawForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import RawResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { colors } from '../theme';
import { withBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { useSettings } from '../store/settingsStore';
import { Logo } from '../components/ui';

// Each screen sits in its own error boundary: a crash shows "Try again" on that screen, not a closed app.
const WelcomeScreen = withBoundary(RawWelcomeScreen, 'welcome');
const LibraryScreen = withBoundary(RawLibraryScreen, 'library');
const ItemScreen = withBoundary(RawItemScreen, 'item');
const DesignsScreen = withBoundary(RawDesignsScreen, 'designs');
const SettingsScreen = withBoundary(RawSettingsScreen, 'settings');
const ARScreen = withBoundary(RawARScreen, 'ar');
const RoomsScreen = withBoundary(RawRoomsScreen, 'rooms');
const RoomStudioScreen = withBoundary(RawRoomStudioScreen, 'roomstudio');
const RoomDetailScreen = withBoundary(RawRoomDetailScreen, 'roomdetail');
const PlanScreen = withBoundary(RawPlanScreen, 'plan');
const SharedDesignScreen = withBoundary(RawSharedDesignScreen, 'shareddesign');
const SignInScreen = withBoundary(RawSignInScreen, 'signin');
const SignUpScreen = withBoundary(RawSignUpScreen, 'signup');
const VerifyEmailScreen = withBoundary(RawVerifyEmailScreen, 'verifyemail');
const ForgotPasswordScreen = withBoundary(RawForgotPasswordScreen, 'forgotpassword');
const ResetPasswordScreen = withBoundary(RawResetPasswordScreen, 'resetpassword');

export type RootStackParamList = {
  Welcome: undefined;
  Tabs: undefined;
  Item: { id: string };
  RoomDetail: { id: string };
  AR: { productId?: string; designId?: string; starter?: boolean; mode?: 'scan'; sharedItems?: import('../types/furniture').SavedDesign['items']; fromPlan?: boolean };
  Plan: { designId?: string; productId?: string } | undefined;
  RoomStudio: { kind: import('../studio/studio').KindId };
  SharedDesign: { slug: string };
  SignIn: undefined;
  SignUp: undefined;
  VerifyEmail: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// [filled when selected, outline otherwise]
const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Library: ['grid', 'grid-outline'], Rooms: ['home', 'home-outline'], Saved: ['heart', 'heart-outline'], Settings: ['settings', 'settings-outline'],
};

function Tabs() {
  return (
    <View style={{ flex: 1 }}>
    <OfflineBanner />
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={TAB_ICONS[route.name]?.[focused ? 0 : 1] ?? 'ellipse'} size={size} color={color} />,
      tabBarActiveTintColor: colors.accent, headerShadowVisible: false, headerLeft: () => <View style={{ marginLeft: 16 }}><Logo size={28} showName={false} /></View> })}>
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: t('tabs.library') }} />
      <Tab.Screen name="Rooms" component={RoomsScreen} options={{ title: t('tabs.rooms') }} />
      <Tab.Screen name="Saved" component={DesignsScreen} options={{ title: t('tabs.saved') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('tabs.settings') }} />
    </Tab.Navigator>
    </View>
  );
}

export function RootNavigator() {
  // Wait for saved settings to load so returning users don't see the onboarding page flash.
  const [ready, setReady] = useState(useSettings.persist.hasHydrated());
  useEffect(() => useSettings.persist.onFinishHydration(() => setReady(true)), []);
  const onboarded = useSettings((s) => s.onboarded);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Stack.Navigator initialRouteName={onboarded ? 'Tabs' : 'Welcome'}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Item" component={ItemScreen} options={{ title: '' }} />
      <Stack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: t('nav.room') }} />
      <Stack.Screen name="AR" component={ARScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RoomStudio" component={RoomStudioScreen} options={{ title: t('rooms.designARoom') }} />
      <Stack.Screen name="Plan" component={PlanScreen} options={{ title: t('nav.plan') }} />
      <Stack.Screen name="SharedDesign" component={SharedDesignScreen} options={{ title: t('nav.shared') }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: t('nav.signIn') }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: t('nav.signUp') }} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: t('nav.verify') }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: t('nav.forgot') }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: t('nav.reset') }} />
    </Stack.Navigator>
  );
}
