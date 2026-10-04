import type { Product } from '../types/furniture';

/**
 * Set EXPO_PUBLIC_API_URL to your server (e.g. http://192.168.1.20:4000 for a phone on your Wi-Fi,
 * http://10.0.2.2:4000 for the Android emulator). When unset, the app uses the bundled catalogue.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API_URL + path, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${(await res.json().catch(() => ({}))).error ?? ''}`.trim());
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchProducts = () => request<{ items: Product[] }>('/products?limit=100').then((r) => r.items);
