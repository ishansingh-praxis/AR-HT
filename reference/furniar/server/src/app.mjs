import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { checkGlb } from './glb.mjs';
import { tx } from './db.mjs';
import { productInput, registerInput, loginInput, designInput, eventsInput } from './schemas.mjs';

export function createApp({ db, jwtSecret, uploadDir, publicUrl = '', adminEmails = [], authLimit = 30 }) {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json({ limit: '1mb' }));
  fs.mkdirSync(path.join(uploadDir, 'models'), { recursive: true });
  app.use('/files', express.static(uploadDir, { maxAge: '7d', immutable: true }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  const sign = (u) => jwt.sign({ sub: u.id }, jwtSecret, { expiresIn: '30d' });
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
  const parseProduct = (row) => JSON.parse(row.data);
  const err = (status, message, extra) => Object.assign(new Error(message), { status, extra });

  const auth = (req, _res, next) => {
    const h = req.headers.authorization ?? '';
    if (!h.startsWith('Bearer ')) throw err(401, 'Sign in required');
    let id;
    try { id = jwt.verify(h.slice(7), jwtSecret).sub; } catch { throw err(401, 'Session expired. Sign in again.'); }
    const u = db.prepare('SELECT id,email,name,role FROM users WHERE id=?').get(id);
    if (!u) throw err(401, 'Account not found');
    req.user = u;
    next();
  };
  const admin = (req, _res, next) => { if (req.user.role !== 'admin') throw err(403, 'Admin only'); next(); };

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // ---- Auth ----
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: true, legacyHeaders: false });
  app.post('/auth/register', limiter, (req, res) => {
    const { email, password, name } = registerInput.parse(req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw err(409, 'An account with this email already exists');
    const role = adminEmails.includes(email) ? 'admin' : 'user';
    const r = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)')
      .run(email, name ?? null, bcrypt.hashSync(password, 10), role, Date.now());
    const user = { id: Number(r.lastInsertRowid), email, name: name ?? null, role };
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  });
  app.post('/auth/login', limiter, (req, res) => {
    const { email, password } = loginInput.parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    if (!u || !bcrypt.compareSync(password, u.password_hash)) throw err(401, 'Email or password is incorrect');
    res.json({ token: sign(u), user: publicUser(u) });
  });
  app.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
  app.delete('/me', auth, (req, res) => { db.prepare('DELETE FROM users WHERE id=?').run(req.user.id); res.status(204).end(); });

  // ---- Catalogue ----
  app.get('/categories', (_req, res) =>
    res.json(db.prepare('SELECT category AS name, COUNT(*) AS count FROM products GROUP BY category').all().map((r) => ({ name: r.name, count: Number(r.count) }))));
  app.get('/products', (req, res) => {
    const { category, role, q, roomType } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    let list = db.prepare('SELECT data FROM products ORDER BY rowid').all().map(parseProduct);
    if (category) list = list.filter((p) => p.category === category);
    if (role) list = list.filter((p) => p.role === role);
    if (roomType) list = list.filter((p) => p.roomTypes.includes(roomType));
    if (q) list = list.filter((p) => `${p.name} ${p.brand} ${p.material} ${p.subcategory}`.toLowerCase().includes(String(q).toLowerCase()));
    res.json({ total: list.length, items: list.slice(offset, offset + limit) });
  });
  app.get('/products/:id', (req, res) => {
    const row = db.prepare('SELECT data FROM products WHERE id=?').get(req.params.id);
    if (!row) throw err(404, 'Product not found');
    res.json(parseProduct(row));
  });

  // ---- Wishlist ----
  app.get('/wishlist', auth, (req, res) =>
    res.json(db.prepare('SELECT product_id FROM wishlist WHERE user_id=?').all(req.user.id).map((r) => r.product_id)));
  app.put('/wishlist/:productId', auth, (req, res) => {
    if (!db.prepare('SELECT 1 FROM products WHERE id=?').get(req.params.productId)) throw err(404, 'Product not found');
    db.prepare('INSERT OR IGNORE INTO wishlist(user_id,product_id) VALUES(?,?)').run(req.user.id, req.params.productId);
    res.status(204).end();
  });
  app.delete('/wishlist/:productId', auth, (req, res) => {
    db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.user.id, req.params.productId);
    res.status(204).end();
  });

  // ---- Designs ----
  app.get('/designs', auth, (req, res) =>
    res.json(db.prepare('SELECT id,name,data,created_at FROM designs WHERE user_id=? ORDER BY id DESC').all(req.user.id)
      .map((d) => ({ id: Number(d.id), name: d.name, createdAt: Number(d.created_at), ...JSON.parse(d.data) }))));
  app.post('/designs', auth, (req, res) => {
    const d = designInput.parse(req.body);
    const known = db.prepare('SELECT id FROM products').all().map((r) => r.id);
    if (d.items.some((i) => !known.includes(i.productId))) throw err(400, 'Design references an unknown product');
    const count = Number(db.prepare('SELECT COUNT(*) AS n FROM designs WHERE user_id=?').get(req.user.id).n);
    const name = d.name ?? `Design ${count + 1}`;
    const r = db.prepare('INSERT INTO designs(user_id,name,data,created_at) VALUES(?,?,?,?)')
      .run(req.user.id, name, JSON.stringify({ items: d.items }), Date.now());
    res.status(201).json({ id: Number(r.lastInsertRowid), name, items: d.items });
  });
  app.get('/designs/:id', auth, (req, res) => {
    const d = db.prepare('SELECT * FROM designs WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!d) throw err(404, 'Design not found');
    res.json({ id: Number(d.id), name: d.name, createdAt: Number(d.created_at), ...JSON.parse(d.data) });
  });
  app.delete('/designs/:id', auth, (req, res) => {
    db.prepare('DELETE FROM designs WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    res.status(204).end();
  });

  // ---- Admin: create/update products. A GLB is optional; when given it must match the listed dimensions. ----
  const saveModel = (id, version, buf) => {
    fs.writeFileSync(path.join(uploadDir, 'models', `${id}-v${version}.glb`), buf);
    return `${publicUrl}/files/models/${id}-v${version}.glb`;
  };
  const readProductField = (req) => {
    try { return productInput.parse(JSON.parse(req.body?.product ?? '')); }
    catch (e) { if (e instanceof ZodError) throw e; throw err(400, 'Send the product as a JSON string in the "product" field'); }
  };
  const store = (product, insert) => {
    const args = insert ? [product.id, product.category, product.role, JSON.stringify(product)] : [product.category, product.role, JSON.stringify(product), product.id];
    db.prepare(insert ? 'INSERT INTO products(id,category,role,data) VALUES(?,?,?,?)' : 'UPDATE products SET category=?, role=?, data=? WHERE id=?').run(...args);
  };

  app.post('/admin/products', auth, admin, upload.single('model'), async (req, res) => {
    const p = readProductField(req);
    if (db.prepare('SELECT 1 FROM products WHERE id=?').get(p.id)) throw err(409, 'A product with this id already exists');
    let model3D, validation = null;
    if (req.file) {
      validation = await checkGlb(req.file.buffer, p.dimensionsCm);
      if (!validation.ok) throw err(422, 'Model does not match the listed dimensions', validation);
      model3D = { url: saveModel(p.id, 1, req.file.buffer), version: 1, unit: 'm' };
    }
    const product = { ...p, ...(model3D && { model3D }), modelStatus: model3D ? 'ready' : 'proxy', source: 'hometown' };
    store(product, true);
    res.status(201).json({ product, validation });
  });

  app.put('/admin/products/:id', auth, admin, upload.single('model'), async (req, res) => {
    const row = db.prepare('SELECT data FROM products WHERE id=?').get(req.params.id);
    if (!row) throw err(404, 'Product not found');
    const old = parseProduct(row);
    const p = readProductField(req);
    if (p.id !== old.id) throw err(400, 'Product id cannot be changed');
    const d0 = old.dimensionsCm, d1 = p.dimensionsCm;
    const dimsChanged = d0.w !== d1.w || d0.d !== d1.d || d0.h !== d1.h;
    let model3D = old.model3D, validation = null;
    if (req.file) {
      validation = await checkGlb(req.file.buffer, p.dimensionsCm);
      if (!validation.ok) throw err(422, 'Model does not match the listed dimensions', validation);
      const version = (old.model3D?.version ?? 0) + 1;
      model3D = { url: saveModel(p.id, version, req.file.buffer), version, unit: 'm' };
    } else if (dimsChanged && old.model3D) {
      throw err(422, 'Dimensions changed: upload the model again so it can be validated against them');
    }
    const product = { ...old, ...p, ...(model3D && { model3D }), modelStatus: model3D ? 'ready' : 'proxy' };
    store(product, false);
    res.json({ product, validation });
  });

  app.delete('/admin/products/:id', auth, admin, (req, res) => {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    res.status(204).end();
  });

  // ---- Anonymous usage events (feeds recommendation quality) ----
  const eventLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
  app.post('/events', eventLimiter, (req, res) => {
    const { deviceId, events } = eventsInput.parse(req.body);
    const ins = db.prepare('INSERT INTO events(device_id,name,ts,props) VALUES(?,?,?,?)');
    tx(db, () => { for (const e of events) ins.run(deviceId, e.name, e.ts, JSON.stringify(e.props)); });
    res.status(204).end();
  });

  // ---- Errors ----
  app.use((e, _req, res, _next) => {
    if (e instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    if (e instanceof multer.MulterError) return res.status(400).json({ error: e.message });
    if (e.status) return res.status(e.status).json({ error: e.message, ...(e.extra ?? {}) });
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}
