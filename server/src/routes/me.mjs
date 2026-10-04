import { Router } from 'express';
import { z } from 'zod';
import { publicUser } from '../lib/http.mjs';

const ACCOUNT_DELETE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Delete your HomeTown AR account</title>
<style>body{font:16px system-ui;max-width:440px;margin:32px auto;padding:0 18px;color:#14211f}input,button{font:inherit;padding:11px;margin:6px 0;width:100%;box-sizing:border-box}
button{background:#b3402f;color:#fff;border:0;border-radius:8px;cursor:pointer}#out{margin-top:14px}</style></head><body>
<h2>Delete your HomeTown AR account</h2>
<p>Sign in to permanently delete your account, saved designs, saved furniture and uploaded images. This cannot be undone.</p>
<form id="f"><input id="email" type="email" placeholder="Email" autocomplete="username" required>
<input id="pw" type="password" placeholder="Password" autocomplete="current-password" required>
<label><input id="ok" type="checkbox" style="width:auto" required> I understand this deletes everything</label>
<button>Delete my account</button></form><p id="out" role="status"></p>
<script>
const out=t=>document.getElementById('out').textContent=t;
document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();
 const j=(r)=>r.json().catch(()=>({}));
 const l=await fetch('/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value,password:pw.value})});
 const b=await j(l); if(!l.ok) return out(b.error||'Sign-in failed');
 const d=await fetch('/v1/me',{method:'DELETE',headers:{authorization:'Bearer '+b.accessToken}});
 out(d.ok?'Your account and data have been deleted.':'Could not delete the account. Try again.');});
</script></body></html>`;

export function meRouter({ db, auth, storage, tokens }) {
  const r = Router();
  r.get('/', auth, (req, res) => res.json({ user: publicUser(req.user) }));
  r.patch('/', auth, async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    await db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.user.id);
    res.json({ user: publicUser({ ...req.user, name }) });
  });
  // Deletes the account and everything tied to it: designs, wishlist, identities and tokens (cascade), and stored thumbnails.
  r.delete('/', auth, async (req, res) => {
    await tokens.revokeAll(req.user.id);
    storage.deletePrefix(`thumbnails/${req.user.id}`);
    await db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
    res.status(204).end();
  });
  return r;
}

/** Public web page the Play Store requires: a place to delete an account without installing the app. */
export function accountPageRouter() {
  const r = Router();
  r.get('/delete', (_req, res) => res.type('html').set('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'").send(ACCOUNT_DELETE_PAGE));
  return r;
}
