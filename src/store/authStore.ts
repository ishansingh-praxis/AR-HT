import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Tokens } from '../sync/http';

const SESSION_KEY = 'auth-session';
const OLD_TOKEN_KEY = 'auth-token'; // builds before step 11 kept one long-lived token here; it cannot be refreshed, so it is dropped

export interface AccountUser { id: number; email: string; name: string | null; role: string; emailVerified: boolean }
export type AuthStatus = 'guest' | 'signedIn' | 'unverified';

/**
 * Guest mode is the default. Tokens live in the OS keystore (SecureStore); only the user profile is kept in AsyncStorage.
 * `token` is the short-lived access token. Network calls go through services/http.ts, which refreshes it.
 */
interface AuthState {
  user: AccountUser | null;
  /** Kept for existing callers that only need the email. */
  email: string | null;
  token: string | null;
  refreshToken: string | null;
  setSession: (s: { accessToken: string; refreshToken: string; user: AccountUser } | null) => void;
  setTokens: (t: Tokens | null) => void;
  setUser: (u: AccountUser | null) => void;
}

const persistTokens = (t: Tokens | null) =>
  (t ? SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(t)) : SecureStore.deleteItemAsync(SESSION_KEY)).catch(() => {});

export const authStatus = (s: Pick<AuthState, 'token' | 'user'>): AuthStatus => (!s.token ? 'guest' : s.user && !s.user.emailVerified ? 'unverified' : 'signedIn');
export const useAuthStatus = () => useAuth(authStatus);

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null, email: null, token: null, refreshToken: null,
      setSession: (s) => {
        persistTokens(s ? { accessToken: s.accessToken, refreshToken: s.refreshToken } : null);
        set(s ? { token: s.accessToken, refreshToken: s.refreshToken, user: s.user, email: s.user.email } : { token: null, refreshToken: null, user: null, email: null });
      },
      setTokens: (t) => { persistTokens(t); set({ token: t?.accessToken ?? null, refreshToken: t?.refreshToken ?? null, ...(t ? {} : { user: null, email: null }) }); },
      setUser: (user) => set({ user, email: user?.email ?? null }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user, email: s.email }),
      onRehydrateStorage: () => () => {
        SecureStore.deleteItemAsync(OLD_TOKEN_KEY).catch(() => {});
        SecureStore.getItemAsync(SESSION_KEY).then((raw) => {
          if (!raw) return;
          try { const t = JSON.parse(raw) as Tokens; useAuth.setState({ token: t.accessToken, refreshToken: t.refreshToken }); } catch { /* corrupt: stay a guest */ }
        }).catch(() => {});
      },
    },
  ),
);
