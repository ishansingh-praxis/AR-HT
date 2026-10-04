import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const scryptAsync = promisify(scrypt);
// scrypt (memory-hard, built into Node so there is no native build step) with OWASP-recommended parameters.
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 32;
const maxmem = (n, r) => 128 * n * r * 2;

const common = new Set(fs.readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8').split('\n').filter(Boolean));

/** Why a password is not acceptable, or null when it is fine. */
export function passwordProblem(password, email = '') {
  if (password.length < 8) return 'Use at least 8 characters';
  if (common.has(password.toLowerCase())) return 'That password is too common. Pick something less guessable';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Do not include your email name in the password';
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: maxmem(N, R) });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Verifies scrypt hashes and legacy bcrypt hashes. A hash of "!" (social-only account) never matches. */
export async function verifyPassword(password, stored) {
  if (!stored || stored === '!') return false;
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
  const [alg, n, r, p, salt, key] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(key, 'base64');
  const got = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p, maxmem: maxmem(+n, +r) });
  return timingSafeEqual(got, want);
}

/** Old bcrypt hashes are replaced with scrypt at the next successful login. */
export const needsRehash = (stored) => !!stored && stored !== '!' && !stored.startsWith(`scrypt$${N}$`);
export const NO_PASSWORD = '!';
