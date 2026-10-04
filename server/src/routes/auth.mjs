import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { loginInput, registerInput } from '../schemas.mjs';
import { err, publicUser } from '../lib/http.mjs';
import { hashPassword, needsRehash, NO_PASSWORD, passwordProblem, verifyPassword } from '../lib/passwords.mjs';

const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const email = z.email().transform((e) => e.toLowerCase());
const codeInput = z.object({ code: z.string().regex(/^\d{6}$/, 'The code is 6 digits') });

export function authRouter({ db, tokens, codes, mailer, auth, authLimit, verifyGoogle, verifyApple }) {
  const r = Router();
  // Limits per IP and per email, so one address cannot be hammered from many IPs (or one IP spread over many emails).
  const byIp = rateLimit({ windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: true, legacyHeaders: false });
  const byEmail = rateLimit({
    windowMs: 15 * 60 * 1000, limit: Math.max(5, Math.floor(authLimit / 3)), standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => `email:${String(req.body?.email ?? '').toLowerCase().slice(0, 120)}`, validate: false,
    skip: (req) => !req.body?.email,
  });
  const limits = [byIp, byEmail];

  const session = (user, req, extra = {}) => {
    const s = tokens.issue(user, req.headers['user-agent']);
    return { token: s.accessToken, ...s, user: publicUser(user), ...extra };
  };
  const userById = (id) => db.prepare('SELECT id,email,name,role,email_verified_at,disabled_at FROM users WHERE id=?').get(id);
  const sendVerification = async (user) => {
    const code = codes.create(user.id, 'verify');
    await mailer.send({ to: user.email, subject: 'Your HomeTown AR verification code', text: `Your code is ${code}. It works for 15 minutes.` });
  };

  r.post('/register', ...limits, async (req, res) => {
    const { email: addr, password, name } = registerInput.parse(req.body);
    const bad = passwordProblem(password, addr);
    if (bad) throw err(400, bad);
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(addr)) throw err(409, 'An account with this email already exists');
    const row = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)')
      .run(addr, name ?? null, await hashPassword(password), 'user', Date.now()); // admins are made only with server/scripts/make-admin.mjs
    const user = userById(row.lastInsertRowid);
    sendVerification(user).catch((e) => req.log?.warn({ err: e }, 'verification mail failed'));
    res.status(201).json(session(user, req));
  });

  r.post('/login', ...limits, async (req, res) => {
    const { email: addr, password } = loginInput.parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(addr);
    if (u?.locked_until && u.locked_until > Date.now()) throw err(429, 'Too many failed attempts. Try again in 15 minutes, or reset your password.');
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      if (u) {
        const fails = u.failed_logins + 1;
        db.prepare('UPDATE users SET failed_logins=?, locked_until=? WHERE id=?').run(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? Date.now() + LOCK_MS : null, u.id);
      }
      throw err(401, 'Email or password is incorrect');
    }
    if (u.disabled_at) throw err(403, 'This account is disabled');
    db.prepare('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=?').run(u.id);
    if (needsRehash(u.password_hash)) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(password), u.id);
    res.json(session(userById(u.id), req));
  });

  // Swap a refresh token for a new pair. A reused (already rotated) token revokes the whole login family.
  r.post('/refresh', byIp, (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20).max(200) }).parse(req.body);
    const s = tokens.rotate(refreshToken, req.headers['user-agent']);
    if (!s) throw err(401, 'Session expired. Sign in again.');
    res.json({ token: s.accessToken, accessToken: s.accessToken, refreshToken: s.refreshToken, expiresIn: s.expiresIn, user: publicUser(s.user) });
  });
  r.post('/logout', (req, res) => { if (typeof req.body?.refreshToken === 'string') tokens.revoke(req.body.refreshToken); res.status(204).end(); });
  r.post('/logout-all', auth, (req, res) => { tokens.revokeAll(req.user.id); res.status(204).end(); });

  // Email verification
  r.post('/verify-email/request', auth, byIp, async (req, res) => {
    if (req.user.email_verified_at) return res.json({ ok: true, alreadyVerified: true });
    await sendVerification(req.user);
    res.json({ ok: true });
  });
  r.post('/verify-email/confirm', auth, byIp, (req, res) => {
    const { code } = codeInput.parse(req.body);
    if (!codes.verify(req.user.id, 'verify', code)) throw err(400, 'That code is wrong or has expired. Request a new one.');
    db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(Date.now(), req.user.id);
    res.json({ ok: true });
  });

  // Password reset. `forgot` answers the same way whether or not the email has an account.
  r.post('/password/forgot', ...limits, async (req, res) => {
    const { email: addr } = z.object({ email }).parse(req.body);
    const u = db.prepare('SELECT id,email,disabled_at FROM users WHERE email=?').get(addr);
    if (u && !u.disabled_at) {
      const code = codes.create(u.id, 'reset');
      await mailer.send({ to: u.email, subject: 'Reset your HomeTown AR password', text: `Your reset code is ${code}. It works for 15 minutes. If you did not ask for this, ignore this email.` }).catch((e) => req.log?.warn({ err: e }, 'reset mail failed'));
    }
    res.json({ ok: true });
  });
  r.post('/password/reset', ...limits, async (req, res) => {
    const body = z.object({ email, password: z.string().min(8).max(128) }).and(codeInput).parse(req.body);
    const u = db.prepare('SELECT id,email FROM users WHERE email=?').get(body.email);
    const bad = passwordProblem(body.password, u?.email ?? body.email);
    if (bad) throw err(400, bad); // checked first, so a too-weak password does not use up the one-time code
    if (!u || !codes.verify(u.id, 'reset', body.code)) throw err(400, 'That code is wrong or has expired. Request a new one.');
    db.prepare('UPDATE users SET password_hash=?, failed_logins=0, locked_until=NULL, email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').run(await hashPassword(body.password), Date.now(), u.id);
    tokens.revokeAll(u.id);
    res.json({ ok: true });
  });

  /**
   * Finds or creates the account for a social login. An existing account with the same email is linked only when the
   * provider says the email is verified; an unverified match is refused rather than silently taken over.
   */
  function socialLogin(provider, p, nameHint, req) {
    const found = db.prepare('SELECT user_id FROM auth_identities WHERE provider=? AND subject=?').get(provider, p.subject);
    let user = found ? userById(found.user_id) : null;
    if (!user) {
      if (!p.email) throw err(400, 'This sign-in did not share an email address, so an account cannot be created');
      const same = db.prepare('SELECT id FROM users WHERE email=?').get(p.email);
      if (same) {
        if (!p.emailVerified) throw err(409, 'An account with this email exists. Sign in with your password first.');
        user = userById(same.id);
      } else {
        const row = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at,email_verified_at) VALUES(?,?,?,?,?,?)')
          .run(p.email, (nameHint ?? p.name ?? null), NO_PASSWORD, 'user', Date.now(), p.emailVerified ? Date.now() : null);
        user = userById(row.lastInsertRowid);
      }
      db.prepare('INSERT INTO auth_identities(user_id,provider,subject) VALUES(?,?,?)').run(user.id, provider, p.subject);
      if (p.emailVerified && !user.email_verified_at) db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(Date.now(), user.id);
    }
    if (user.disabled_at) throw err(403, 'This account is disabled');
    const name = nameHint ?? p.name;
    if (name && !user.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(name.slice(0, 80), user.id); // Apple sends the name only once
    return session(userById(user.id), req);
  }
  r.post('/google', byIp, async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(20).max(4000) }).parse(req.body);
    res.json(socialLogin('google', await verifyGoogle(idToken), undefined, req));
  });
  r.post('/apple', byIp, async (req, res) => {
    const { identityToken, name } = z.object({ identityToken: z.string().min(20).max(4000), name: z.string().max(80).optional() }).parse(req.body);
    res.json(socialLogin('apple', await verifyApple(identityToken), name, req));
  });
  return r;
}
