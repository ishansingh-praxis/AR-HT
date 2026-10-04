import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { checkGlb } from '../lib/glb.mjs';
import { err, productFromRow } from '../lib/http.mjs';
import { deleteProduct, upsertProduct } from '../db.mjs';
import { audit } from '../lib/audit.mjs';
import { productInput } from '../schemas.mjs';
import { z } from 'zod';

/** Admin: create/update/delete products. A GLB is optional on create (modelStatus 'proxy'); when sent it is validated against the listed size. */
export function adminRouter({ db, auth, admin, editor, storage, filesBase, publicUrl, tokens }) {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  const view = (product) => productFromRow({ data: JSON.stringify(product) }, filesBase);

  const saveModel = (id, version, buf) => storage.putObject(`models/${id}-v${version}.glb`, buf);
  const recordModel = (id, version, key, size, check, actorId, status = 'ready') =>
    db.prepare('INSERT OR REPLACE INTO models(product_id,version,glb_key,size_mb,w_cm,d_cm,h_cm,status,report,reviewed_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, version, key, size / 1e6, check.sizeCm?.w ?? null, check.sizeCm?.d ?? null, check.sizeCm?.h ?? null, status, JSON.stringify(check), status === 'ready' ? actorId : null, Date.now());
  const readProductField = (req) => {
    try { return productInput.parse(JSON.parse(req.body?.product ?? '')); }
    catch (e) { if (e instanceof ZodError) throw e; throw err(400, 'Send the product as a JSON string in the "product" field'); }
  };

  r.post('/products', auth, editor, upload.single('model'), async (req, res) => {
    const p = readProductField(req);
    if (db.prepare('SELECT 1 FROM products WHERE id=?').get(p.id)) throw err(409, 'A product with this id already exists');
    let product = { ...p, modelStatus: 'proxy' }, check = null;
    if (req.file) {
      check = await checkGlb(req.file.buffer, p.dimensionsCm);
      if (!check.ok) throw err(422, 'Model does not match the listed dimensions', check);
      product = { ...p, modelStatus: 'ready', model3D: { key: saveModel(p.id, 1, req.file.buffer), version: 1, unit: 'm' } };
    }
    upsertProduct(db, product);
    if (req.file) recordModel(p.id, 1, product.model3D.key, req.file.buffer.length, check, req.user.id);
    audit(db, req.user.id, 'product.create', p.id);
    res.status(201).json({ product: view(product), validation: check });
  });

  r.put('/products/:id', auth, editor, upload.single('model'), async (req, res) => {
    const row = db.prepare('SELECT data FROM products WHERE id=?').get(req.params.id);
    if (!row) throw err(404, 'Product not found');
    const old = JSON.parse(row.data);
    const given = Object.keys(JSON.parse(req.body.product ?? '{}'));
    const p = readProductField(req);
    if (p.id !== old.id) throw err(400, 'Product id cannot be changed');
    const d0 = old.dimensionsCm, d1 = p.dimensionsCm;
    const dimsChanged = given.includes('dimensionsCm') && (d0.w !== d1.w || d0.d !== d1.d || d0.h !== d1.h);
    let model3D = old.model3D, modelStatus = old.modelStatus, validation = null;
    // Only fields the admin actually sent are changed, so a PUT can never blank out photos or links.
    const patch = Object.fromEntries(given.filter((k) => k in p).map((k) => [k, p[k]]));
    const dims = patch.dimensionsCm ?? old.dimensionsCm;
    if (req.file) {
      validation = await checkGlb(req.file.buffer, dims);
      if (!validation.ok) throw err(422, 'Model does not match the listed dimensions', validation);
      const version = (old.model3D?.version ?? 0) + 1;
      model3D = { key: saveModel(p.id, version, req.file.buffer), version, unit: 'm' };
      modelStatus = 'ready';
    } else if (dimsChanged && old.model3D) {
      throw err(422, 'Dimensions changed: upload the model again so it can be validated against them');
    }
    const product = { ...old, ...patch, ...(model3D ? { model3D } : {}), ...(modelStatus ? { modelStatus } : {}) };
    upsertProduct(db, product);
    if (req.file) recordModel(p.id, model3D.version, model3D.key, req.file.buffer.length, validation, req.user.id);
    audit(db, req.user.id, 'product.update', p.id, { fields: given, model: !!req.file });
    res.json({ product: view(product), validation });
  });

  r.delete('/products/:id', auth, editor, (req, res) => {
    deleteProduct(db, req.params.id);
    audit(db, req.user.id, 'product.delete', req.params.id);
    res.status(204).end();
  });

  // Model upload without sending the file through the JSON API: ask for a signed link, PUT the GLB to it, then validate.
  const nextVersion = (id, product) => Math.max(product.model3D?.version ?? 0, Number(db.prepare('SELECT MAX(version) AS v FROM models WHERE product_id=?').get(id)?.v ?? 0)) + 1;
  const getProduct = (id) => {
    const row = db.prepare('SELECT data FROM products WHERE id=?').get(id);
    if (!row) throw err(404, 'Product not found');
    return JSON.parse(row.data);
  };
  r.post('/models/:productId/upload-url', auth, editor, (req, res) => {
    const product = getProduct(req.params.productId);
    const version = nextVersion(product.id, product);
    const key = `models/${product.id}-v${version}.glb`;
    const token = storage.signUpload(key, { maxBytes: 25 * 1024 * 1024 });
    res.json({ key, version, method: 'PUT', uploadUrl: `${publicUrl}/v1/uploads/${token}`, expiresInSec: 600 });
  });
  r.post('/models/:productId/validate', auth, editor, async (req, res) => {
    const product = getProduct(req.params.productId);
    const key = String(req.body?.key ?? '');
    const m = key.match(/^models\/(.+)-v(\d+)\.glb$/);
    if (!m || m[1] !== product.id) throw err(400, 'key must be the one returned by upload-url');
    const buf = storage.getObject(key);
    if (!buf) throw err(404, 'Nothing was uploaded to this key yet');
    const check = await checkGlb(buf, product.dimensionsCm);
    if (!check.ok) { storage.deleteObject(key); throw err(422, 'Model does not match the listed dimensions', check); }
    const version = Number(m[2]);
    if (req.body?.review === true) { // wait for a human to look at it next to the photos
      recordModel(product.id, version, key, buf.length, check, req.user.id, 'pending');
      audit(db, req.user.id, 'model.submit', product.id, { version });
      return res.status(202).json({ status: 'pending', validation: check });
    }
    const next = { ...product, modelStatus: 'ready', model3D: { key, version, unit: 'm' } };
    upsertProduct(db, next); // bumps the catalogue version so apps pick the model up
    recordModel(product.id, version, key, buf.length, check, req.user.id);
    audit(db, req.user.id, 'model.publish', product.id, { version });
    res.json({ product: view(next), validation: check });
  });
  r.get('/models/:productId', auth, editor, (req, res) => {
    const rows = db.prepare('SELECT id,version,glb_key,size_mb,w_cm,d_cm,h_cm,status,created_at FROM models WHERE product_id=? ORDER BY version DESC').all(req.params.productId);
    res.json(rows.map((x) => ({ ...x, url: storage.publicUrl(x.glb_key) })));
  });
  r.get('/audit', auth, admin, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json(db.prepare('SELECT id,actor_id,action,target,at,data FROM audit_log ORDER BY id DESC LIMIT ?').all(limit).map((x) => ({ ...x, data: x.data ? JSON.parse(x.data) : null })));
  });
  // Users (admin only). Every change is audit-logged.
  const userRow = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, emailVerified: !!u.email_verified_at, disabled: !!u.disabled_at, createdAt: u.created_at });
  r.get('/users', auth, admin, (req, res) => {
    const q = `%${String(req.query.q ?? '').toLowerCase()}%`;
    const rows = db.prepare('SELECT id,email,name,role,email_verified_at,disabled_at,created_at FROM users WHERE lower(email) LIKE ? OR lower(COALESCE(name,\'\')) LIKE ? ORDER BY id DESC LIMIT 100').all(q, q);
    res.json(rows.map(userRow));
  });
  r.patch('/users/:id', auth, admin, (req, res) => {
    const body = z.object({ role: z.enum(['user', 'editor', 'admin']).optional(), disabled: z.boolean().optional() }).refine((b) => b.role !== undefined || b.disabled !== undefined, 'Send a role or disabled').parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!u) throw err(404, 'User not found');
    if (u.id === req.user.id) throw err(400, 'You cannot change your own role or disable yourself');
    if (body.role !== undefined) db.prepare('UPDATE users SET role=? WHERE id=?').run(body.role, u.id);
    if (body.disabled !== undefined) {
      db.prepare('UPDATE users SET disabled_at=? WHERE id=?').run(body.disabled ? Date.now() : null, u.id);
      if (body.disabled) tokens.revokeAll(u.id);
    }
    audit(db, req.user.id, 'user.update', String(u.id), { role: body.role, disabled: body.disabled, from: { role: u.role } });
    res.json(userRow(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)));
  });
  r.delete('/users/:id', auth, admin, (req, res) => {
    const u = db.prepare('SELECT id,email FROM users WHERE id=?').get(req.params.id);
    if (!u) throw err(404, 'User not found');
    if (u.id === req.user.id) throw err(400, 'Delete your own account from the app or /account/delete');
    storage.deletePrefix(`thumbnails/${u.id}`);
    db.prepare('DELETE FROM users WHERE id=?').run(u.id);
    audit(db, req.user.id, 'user.delete', String(u.id), { email: u.email });
    res.status(204).end();
  });
  return r;
}
