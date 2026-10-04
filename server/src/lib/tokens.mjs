import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Access JWTs (15 min) and rotating refresh tokens (30 days, random, stored only as a hash). */
export function createTokens({ db, jwtSecret }) {
  const signAccess = (u) => jwt.sign({ sub: u.id, role: u.role }, jwtSecret, { expiresIn: ACCESS_TTL_SEC });
  const verifyAccess = (token) => jwt.verify(token, jwtSecret);

  const insert = (userId, family, userAgent) => {
    const token = randomBytes(32).toString('base64url'); // 256 bits
    db.prepare('INSERT INTO refresh_tokens(user_id,family,token_hash,expires_at,user_agent,created_at) VALUES(?,?,?,?,?,?)')
      .run(userId, family, sha256(token), Date.now() + REFRESH_TTL_MS, userAgent?.slice(0, 200) ?? null, Date.now());
    return token;
  };
  /** A new session: access + refresh token. */
  const issue = (user, userAgent) => ({ accessToken: signAccess(user), refreshToken: insert(user.id, randomUUID(), userAgent), expiresIn: ACCESS_TTL_SEC });

  /**
   * Swaps a refresh token for a new pair. The old one is revoked. If a revoked token is shown again, someone copied it:
   * the whole family (every token descended from that login) is revoked.
   * Returns null when the token is unknown, expired or reused.
   */
  const rotate = (token, userAgent) => {
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash=?').get(sha256(String(token)));
    if (!row) return null;
    if (row.revoked_at) { db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE family=? AND revoked_at IS NULL').run(Date.now(), row.family); return null; }
    if (row.expires_at < Date.now()) return null;
    const user = db.prepare('SELECT id,email,name,role,email_verified_at,disabled_at FROM users WHERE id=?').get(row.user_id);
    if (!user || user.disabled_at) return null;
    db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE id=?').run(Date.now(), row.id);
    return { user, accessToken: signAccess(user), refreshToken: insert(user.id, row.family, userAgent), expiresIn: ACCESS_TTL_SEC };
  };
  const revoke = (token) => db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').run(Date.now(), sha256(String(token))).changes > 0;
  const revokeAll = (userId) => db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(Date.now(), userId).changes;
  return { signAccess, verifyAccess, issue, rotate, revoke, revokeAll };
}

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;

/** Six-digit one-time codes for email verification and password reset: 15 minutes, 5 tries, stored as hashes. */
export function createCodes({ db }) {
  const create = (userId, purpose) => {
    db.prepare('UPDATE email_codes SET used_at=? WHERE user_id=? AND purpose=? AND used_at IS NULL').run(Date.now(), userId, purpose);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    db.prepare('INSERT INTO email_codes(user_id,purpose,code_hash,expires_at) VALUES(?,?,?,?)').run(userId, purpose, sha256(`${userId}:${purpose}:${code}`), Date.now() + CODE_TTL_MS);
    return code;
  };
  /** true when the code is right; a wrong guess counts as a try, and after 5 the code is dead. */
  const verify = (userId, purpose, code) => {
    const row = db.prepare('SELECT * FROM email_codes WHERE user_id=? AND purpose=? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(userId, purpose);
    if (!row || row.expires_at < Date.now() || row.attempts >= MAX_TRIES) return false;
    if (row.code_hash !== sha256(`${userId}:${purpose}:${String(code)}`)) { db.prepare('UPDATE email_codes SET attempts=attempts+1 WHERE id=?').run(row.id); return false; }
    db.prepare('UPDATE email_codes SET used_at=? WHERE id=?').run(Date.now(), row.id);
    return true;
  };
  return { create, verify };
}
