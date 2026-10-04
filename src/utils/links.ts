// Pure link helpers (no React / RN imports).

/** Adds UTM tags so HomeTown can see traffic that came from the app. `context` says where the tap happened (item, room, share...). */
export function withUtm(url: string, context: string, medium = 'app'): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'hometown-ar');
    u.searchParams.set('utm_medium', medium);
    u.searchParams.set('utm_campaign', context);
    return u.toString();
  } catch { return url; }
}

/** Extracts the slug from https://<domain>/d/<slug> or hometownar://d/<slug>. */
export function slugFromLink(link: string): string | null {
  const m = link.match(/(?:\/\/[^/]+)?\/d\/([a-z2-9]{10})(?:[/?#]|$)/i) ?? link.match(/^hometownar:\/\/d\/([a-z2-9]{10})/i);
  return m ? m[1].toLowerCase() : null;
}

export interface ShareInput { name: string; roomType?: string; pieceNames: string[]; url?: string }
/** Text for the share sheet. With a link the page carries the plan and products; without one (guests) the list is in the message. */
export function shareMessage({ name, roomType, pieceNames, url }: ShareInput): string {
  if (url) return `See my room plan: ${url}`;
  const counts = new Map<string, number>();
  for (const n of pieceNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  const lines = [...counts].map(([n, c]) => `• ${n}${c > 1 ? ` × ${c}` : ''}`).join('\n');
  return `${name}${roomType ? ` (${roomType})` : ''}\n${lines}\nDesigned with HomeTown AR`;
}
