import type { components } from './schema';

type S = components['schemas'];
export type Product = S['Product'];
export type Room = S['Room'];
export type Stats = S['Stats'];
export type ModelQueue = S['ModelQueue'];
export type GlbReport = S['GlbReport'];
export type ImportPreview = S['ImportPreview'];
export type User = S['User'];

export class ApiError extends Error {
  status: number;
  body: { error?: string; details?: string[]; problems?: string[] } & Record<string, unknown>;
  constructor(status: number, body: ApiError['body']) { super(body.error ?? `Request failed (${status})`); this.status = status; this.body = body; }
}

interface Session { accessToken: string; refreshToken: string; user: User }
const KEY = 'ht-admin-session';
let session: Session | null = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } })();
const listeners = new Set<() => void>();

export const getSession = () => session;
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function setSession(s: Session | null) {
  session = s;
  try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

let refreshing: Promise<boolean> | null = null;
const refresh = () => (refreshing ??= (async () => {
  if (!session) return false;
  const res = await fetch('/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
  if (!res.ok) { setSession(null); return false; }
  const b = await res.json();
  setSession({ accessToken: b.accessToken, refreshToken: b.refreshToken, user: b.user });
  return true;
})().finally(() => { refreshing = null; }));

export async function api<T>(path: string, o: { method?: string; body?: unknown; form?: FormData; auth?: boolean } = {}): Promise<T> {
  const go = () => fetch(`/v1${path}`, {
    method: o.method ?? 'GET',
    headers: { ...(o.auth !== false && session && { authorization: `Bearer ${session.accessToken}` }), ...(o.body !== undefined && { 'content-type': 'application/json' }) },
    body: o.form ?? (o.body === undefined ? undefined : JSON.stringify(o.body)),
  });
  let res = await go();
  if (res.status === 401 && o.auth !== false && session && (await refresh())) res = await go();
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Only editors and admins may use the dashboard. */
export async function signIn(email: string, password: string) {
  const b = await api<Session>('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  if (b.user.role !== 'editor' && b.user.role !== 'admin') throw new ApiError(403, { error: 'This account does not have access to the dashboard.' });
  setSession(b);
}
export const signOut = () => { if (session) fetch('/v1/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) }).catch(() => {}); setSession(null); };

/** Everything in the catalogue (the dashboard filters in the browser: ~700 products). */
export const fetchAllProducts = async () => (await api<{ products: Product[] }>('/catalogue?since=0', { auth: false })).products;
export const messageOf = (e: unknown) => (e instanceof ApiError ? [e.message, ...(e.body.details ?? []), ...(e.body.problems ?? [])].join(' · ') : e instanceof Error ? e.message : 'Something went wrong');
