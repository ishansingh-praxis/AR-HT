// Removes secrets and personal data from crash reports before they leave the phone or the server (used by Sentry's beforeSend on both).
// Pure: no I/O. Tokens, passwords, one-time codes, Authorization headers and email addresses are replaced with "[removed]".

const SECRET_KEY = /^(authorization|cookie|set-cookie|token|accesstoken|refreshtoken|access_token|refresh_token|idtoken|identitytoken|password|passwd|secret|code|otp|jwt|apikey|api_key|x-api-key)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const REMOVED = '[removed]';

export const scrubString = (s) => String(s).replace(BEARER, 'Bearer ' + REMOVED).replace(JWT, REMOVED).replace(EMAIL, REMOVED);

/** Deep copy with secret-looking keys blanked and tokens/emails removed from every string. */
export function scrubValue(v, depth = 0) {
  if (depth > 12) return REMOVED;
  if (typeof v === 'string') return scrubString(v);
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = SECRET_KEY.test(k) ? REMOVED : scrubValue(x, depth + 1);
    return out;
  }
  return v;
}

/** Sentry `beforeSend`: scrubs the whole event and drops the user's email / IP / name. */
export function scrubEvent(event) {
  const e = scrubValue(event);
  if (e.user) e.user = e.user.id !== undefined ? { id: String(e.user.id) } : undefined; // an id is enough to count affected users
  if (e.request) { delete e.request.cookies; delete e.request.data; }
  return e;
}
