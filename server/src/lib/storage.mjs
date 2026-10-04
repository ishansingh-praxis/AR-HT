import fs from 'node:fs';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { err } from './http.mjs';

const KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

/**
 * File storage on the local disk (the `uploads/` folder, or a mounted volume). No cloud account needed.
 * Keys look like `models/<id>-v2.glb`. Files are immutable (a new version gets a new key), so they can be cached forever.
 * `publicBase` is where the files are served from: this server's /files by default, or a CDN/static host in front of the folder.
 */
export function createStorage({ dir, publicBase, secret }) {
  const root = path.resolve(dir);
  fs.mkdirSync(root, { recursive: true });

  /** Absolute path for a key. Rejects anything that could leave the storage folder. */
  const resolve = (key) => {
    if (!KEY.test(key) || key.includes('..') || key.includes('//')) throw err(400, 'Invalid storage key');
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw err(400, 'Invalid storage key');
    return full;
  };
  const putObject = (key, buf) => { const f = resolve(key); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return key; };
  const getObject = (key) => { const f = resolve(key); return fs.existsSync(f) ? fs.readFileSync(f) : null; };
  const deleteObject = (key) => { const f = resolve(key); if (fs.existsSync(f)) fs.rmSync(f); };
  const publicUrl = (key) => `${publicBase}/${key}`;

  // Signed upload tokens: a short-lived, single-key permission to PUT bytes (so large files skip the JSON API).
  const mac = (body) => createHmac('sha256', secret).update(body).digest('base64url');
  const signUpload = (key, { maxBytes = 25 * 1024 * 1024, ttlSec = 600 } = {}) => {
    resolve(key);
    const body = Buffer.from(JSON.stringify({ key, max: maxBytes, exp: Date.now() + ttlSec * 1000 })).toString('base64url');
    return `${body}.${mac(body)}`;
  };
  const verifyUpload = (token) => {
    const [body, sig] = String(token).split('.');
    const want = mac(body ?? '');
    if (!body || !sig || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) throw err(403, 'Invalid upload link');
    const t = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (t.exp < Date.now()) throw err(403, 'Upload link expired');
    return t;
  };
  /** Deletes every object under a prefix (used when an account is deleted). */
  const deletePrefix = (prefix) => { const d = resolve(prefix.replace(/\/$/, '') + '/x'); fs.rmSync(path.dirname(d), { recursive: true, force: true }); };
  return { resolve, putObject, getObject, deleteObject, deletePrefix, publicUrl, signUpload, verifyUpload };
}
