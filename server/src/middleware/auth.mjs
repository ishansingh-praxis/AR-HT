import { err } from '../lib/http.mjs';

/**
 * `auth` requires a valid Bearer access token and sets req.user. Roles: user < editor (products, rooms) < admin (everything + users).
 * `requireRole(...roles)` builds a guard; `editor` allows editor and admin, `admin` allows admin only.
 */
export function authMiddleware({ db, tokens }) {
  const auth = async function auth(req, _res, next) {
    const h = req.headers.authorization ?? '';
    if (!h.startsWith('Bearer ')) throw err(401, 'Sign in required');
    let id;
    try { id = tokens.verifyAccess(h.slice(7)).sub; } catch { throw err(401, 'Session expired. Sign in again.'); }
    const u = await db.prepare('SELECT id,email,name,role,email_verified_at,disabled_at FROM users WHERE id=?').get(id);
    if (!u) throw err(401, 'Account not found');
    if (u.disabled_at) throw err(403, 'This account is disabled');
    req.user = u;
    next();
  };
  const requireRole = (...roles) => {
    const guard = (req, _res, next) => {
      if (!roles.includes(req.user.role)) throw err(403, roles.includes('editor') ? 'Editor or admin only' : 'Admin only');
      next();
    };
    return Object.defineProperty(guard, 'name', { value: `role:${roles.includes('editor') ? 'editor' : roles.join('+')}` });
  };
  return { auth, requireRole, admin: requireRole('admin'), editor: requireRole('editor', 'admin') };
}
