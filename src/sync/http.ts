// Pure HTTP client logic (no React / RN imports): typed errors, timeout, and automatic access-token refresh.

export class ApiError extends Error {
  status: number;
  body?: any;
  constructor(status: number, message: string, body?: any) { super(message); this.name = 'ApiError'; this.status = status; this.body = body; }
  /** True when the request never reached the server (offline, DNS, timeout). */
  get isNetwork() { return this.status === 0; }
}

export interface Tokens { accessToken: string; refreshToken: string }

export interface HttpOptions {
  baseUrl: string;
  tokens: { get(): Tokens | null; set(t: Tokens | null): void };
  /** Called when a refresh fails: the session is over and the user must sign in again. */
  onSignedOut?: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> }

export function createHttp({ baseUrl, tokens, onSignedOut, fetchImpl = fetch, timeoutMs = 10_000 }: HttpOptions) {
  let refreshing: Promise<boolean> | null = null;

  async function send(path: string, o: RequestOptions, access: string | undefined): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetchImpl(baseUrl + path, {
        method: o.method ?? 'GET', signal: ctrl.signal,
        headers: { ...(access && { authorization: `Bearer ${access}` }), ...(o.body !== undefined && { 'content-type': 'application/json' }), ...o.headers },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      });
    } catch {
      throw new ApiError(0, 'Could not reach the server. Check your connection.');
    } finally { clearTimeout(timer); }
  }

  /** One refresh at a time: concurrent 401s wait for the same attempt. */
  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      const t = tokens.get();
      if (!t) return false;
      try {
        const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: t.refreshToken } }, undefined);
        if (res.status === 401 || res.status === 403) { tokens.set(null); onSignedOut?.(); return false; }
        if (!res.ok) return false; // server trouble: keep the session, the caller just fails this once
        const b = await res.json();
        tokens.set({ accessToken: b.accessToken, refreshToken: b.refreshToken });
        return true;
      } catch { return false; } // offline: keep the session
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
    const useAuth = o.auth !== false;
    let res = await send(path, o, useAuth ? tokens.get()?.accessToken : undefined);
    if (res.status === 401 && useAuth && tokens.get()) {
      if (await refresh()) res = await send(path, o, tokens.get()?.accessToken);
    }
    if (!res.ok && res.status !== 304) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body);
    }
    if (res.status === 204 || res.status === 304) return undefined as T;
    return (await res.json()) as T;
  }
  return { request, refresh };
}

/** Builds the API base: accepts https://host, https://host/ or https://host/v1 and always returns .../v1. */
export const apiBase = (url: string) => (url ? url.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1' : '');
