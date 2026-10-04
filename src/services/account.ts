import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountApi, type SessionResponse } from './api';
import { queueEverything, runSync } from './sync';
import { useAuth } from '../store/authStore';
import { useRooms } from '../store/roomStore';
import { useSync } from '../store/syncStore';
import { useWishlist } from '../store/wishlistStore';
import { clearEvents } from './events';

/** Account actions. Each one talks to the API and updates the stores; screens just call them and show errors. */

const start = (r: SessionResponse) => {
  useAuth.getState().setSession({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user });
  queueEverything();
  runSync();
  return r.user;
};

export const signIn = async (email: string, password: string) => start(await accountApi.login(email.trim(), password));
export const signUp = async (email: string, password: string, name?: string) => start(await accountApi.register(email.trim(), password, name?.trim() || undefined));
export const signInWithGoogle = async (idToken: string) => start(await accountApi.google(idToken));
export const signInWithApple = async (identityToken: string, name?: string) => start(await accountApi.apple(identityToken, name));

export const refreshUser = async () => { const { user } = await accountApi.me(); useAuth.getState().setUser(user); return user; };
export const requestVerification = () => accountApi.requestVerification();
export async function verifyEmail(code: string) {
  await accountApi.confirmVerification(code.trim());
  const user = await refreshUser(); // flips status to signedIn, which starts the first sync
  runSync();
  return user;
}
export const forgotPassword = (email: string) => accountApi.forgotPassword(email.trim());
export const resetPassword = (email: string, code: string, password: string) => accountApi.resetPassword(email.trim(), code.trim(), password);

/** Signing out keeps the designs on the phone; they just stop being tied to the account. */
export async function signOut() {
  const refresh = useAuth.getState().refreshToken;
  if (refresh) await accountApi.logout(refresh).catch(() => {}); // best effort: the token also expires on its own
  useAuth.getState().setSession(null);
  useSync.getState().reset();
  useRooms.getState().detachFromCloud();
}

/** Removes everything this app stored on the phone. */
export async function wipeLocalData() {
  useAuth.getState().setSession(null);
  useRooms.getState().clear();
  useWishlist.getState().replaceAll([]);
  useSync.getState().reset();
  clearEvents();
  await AsyncStorage.clear();
}

/** Signed in: delete the account on the server first (so a failure leaves everything intact), then wipe the phone. Guest: wipe only. */
export async function deleteEverything() {
  if (useAuth.getState().token) await accountApi.deleteAccount();
  await wipeLocalData();
}
