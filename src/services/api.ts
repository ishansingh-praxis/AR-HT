import type { Product } from '../types/furniture';
import { API_URL } from '../config';
import { request } from './http';
import type { AccountUser } from '../store/authStore';
import type { CatalogueDelta } from '../sync/catalogue';
import type { DesignBody, EngineIO, RemoteDesign } from '../sync/engine';
import type { WishItem } from '../utils/wishlist';

/**
 * Set EXPO_PUBLIC_API_URL to your server (e.g. http://192.168.1.20:4000 for a phone on your Wi-Fi,
 * http://10.0.2.2:4000 for the Android emulator). When unset, the app uses the bundled catalogue.
 */
export { API_URL };

/** What changed in the catalogue since `version` (0 = everything). */
export const fetchCatalogue = (since: number) => request<CatalogueDelta<Product>>(`/catalogue?since=${since}`, { auth: false });
export type { Product };

export const cloud = { enabled: !!API_URL };

export interface SessionResponse { token: string; accessToken: string; refreshToken: string; expiresIn: number; user: AccountUser }

export const accountApi = {
  register: (email: string, password: string, name?: string) => request<SessionResponse>('/auth/register', { method: 'POST', auth: false, body: { email, password, ...(name && { name }) } }),
  login: (email: string, password: string) => request<SessionResponse>('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  google: (idToken: string) => request<SessionResponse>('/auth/google', { method: 'POST', auth: false, body: { idToken } }),
  apple: (identityToken: string, name?: string) => request<SessionResponse>('/auth/apple', { method: 'POST', auth: false, body: { identityToken, ...(name && { name }) } }),
  me: () => request<{ user: AccountUser }>('/me'),
  requestVerification: () => request<{ ok: boolean }>('/auth/verify-email/request', { method: 'POST' }),
  confirmVerification: (code: string) => request<{ ok: boolean }>('/auth/verify-email/confirm', { method: 'POST', body: { code } }),
  forgotPassword: (email: string) => request<{ ok: boolean }>('/auth/password/forgot', { method: 'POST', auth: false, body: { email } }),
  resetPassword: (email: string, code: string, password: string) => request<{ ok: boolean }>('/auth/password/reset', { method: 'POST', auth: false, body: { email, code, password } }),
  logout: (refreshToken: string) => request<void>('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }),
  deleteAccount: () => request<void>('/me', { method: 'DELETE' }),
};

/** The calls the sync engine needs (see src/sync/engine.ts). */
export const syncApi: EngineIO['api'] = {
  createDesign: (d: DesignBody) => request<RemoteDesign>('/designs', { method: 'POST', body: d }),
  patchDesign: (id, d) => request<RemoteDesign>(`/designs/${id}`, { method: 'PATCH', body: d }),
  deleteDesign: (id) => request<void>(`/designs/${id}`, { method: 'DELETE' }),
  listDesigns: (since) => request(`/designs?since=${since}`),
  wishAdd: (id) => request<void>(`/wishlist/${encodeURIComponent(id)}`, { method: 'PUT' }),
  wishRemove: (id) => request<void>(`/wishlist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listWishlist: () => request<WishItem[]>('/wishlist'),
};

export interface LayoutSlot { productId: string; side: 'front' | 'left' | 'right' | 'back'; gap: number; why?: string }
/** The token argument is kept for existing callers; the HTTP client attaches (and refreshes) the real one. */
export const suggestLayout = (_token: string, body: { roomType: string; anchorId: string; room?: { area: number; maxSpan: number } }) =>
  request<{ slots: LayoutSlot[] }>('/layout/suggest', { method: 'POST', body });
